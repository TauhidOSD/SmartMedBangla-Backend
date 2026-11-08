/**
 * Background job handlers. Each is idempotent so it is safe to run on several instances
 * or to re-run after downtime.
 */
import { env } from "../config/env.js";
import { CareLinkModel } from "../models/careLink.model.js";
import { DoseLogModel } from "../models/doseLog.model.js";
import { InventoryModel } from "../models/inventory.model.js";
import { MedicineModel } from "../models/medicine.model.js";
import { OtpModel } from "../models/otp.model.js";
import { SessionModel } from "../models/session.model.js";
import { UserModel } from "../models/user.model.js";
import { materializeDay } from "../services/dose.service.js";
import { sendEmail } from "../services/email.service.js";
import { placeVoiceCall, sendSms } from "../services/sms.service.js";
import { EXPIRY_WARNING_DAYS } from "../services/inventory.service.js";
import { notify } from "../services/notification.service.js";
import { logger } from "../utils/logger.js";
import { addDays, addMinutes } from "../utils/time.js";
import { buildDoseSpeech, mealTimingLabel } from "../utils/voice.js";
import { emailTemplates } from "../views/emails/templates.js";

/** Hourly: make sure every patient has today's dose rows (covers midnight roll-over). */
export async function materializeAllPatients() {
  const patients = await UserModel.findPatientsWithActiveReminders();
  let created = 0;
  for (const p of patients) created += await materializeDay(p.id, p.timezone);
  return { patients: patients.length, created };
}

/** Every minute: announce doses whose time has come (in-app + push + Bangla voice line). */
export async function dispatchDueReminders() {
  const now = new Date();
  const due = await DoseLogModel.findDueUnnotified(now, addMinutes(now, -env.MISSED_DOSE_GRACE_MINUTES));
  const active = due.filter((d) => d.patient.status === "ACTIVE");
  // Claim these doses first so a slow SMS/call can never cause a duplicate on the next tick.
  if (due.length) await DoseLogModel.markNotified(due.map((d) => d.id));

  for (const dose of active) {
    const lang = dose.patient.language;
    const spoken = buildDoseSpeech({
      language: lang,
      honorific: dose.patient.honorific,
      patientName: dose.patient.name,
      medicineName: dose.medicine.name,
      quantity: dose.reminder.quantity,
      mealTiming: dose.medicine.mealTiming,
    });
    const title = lang === "bn" ? `💊 ${dose.medicine.name} খাওয়ার সময়` : `💊 Time for ${dose.medicine.name}`;
    const message =
      lang === "bn"
        ? `${dose.reminder.time} — ${dose.reminder.quantity}টি, ${mealTimingLabel(dose.medicine.mealTiming, lang)}`
        : `${dose.reminder.time} — take ${dose.reminder.quantity}, ${mealTimingLabel(dose.medicine.mealTiming, lang)}`;
    await notify(dose.patientId, {
      type: "DOSE_REMINDER",
      title,
      message,
      speakText: dose.patient.voiceEnabled ? spoken : null,
      data: { doseId: dose.id, medicineId: dose.medicineId },
      url: "/dashboard",
    });

    // Offline alerts – reach patients without internet or a smartphone.
    if (dose.patient.smsEnabled) await sendSms(dose.patient.phone, `SmartMed: ${dose.medicine.name} — ${message}`);
    if (dose.patient.callEnabled) await placeVoiceCall(dose.patient.phone, spoken, lang);
  }
  return { notified: active.length };
}

/** Every 5 minutes: mark unconfirmed doses as missed and alert patient + caregivers. */
export async function processMissedDoses() {
  const overdue = await DoseLogModel.findOverduePending(addMinutes(new Date(), -env.MISSED_DOSE_GRACE_MINUTES));
  if (!overdue.length) return { missed: 0 };

  await DoseLogModel.markMissed(overdue.map((d) => d.id));

  const byPatient = new Map<string, typeof overdue>();
  for (const dose of overdue) {
    if (dose.patient.status !== "ACTIVE") continue;
    byPatient.set(dose.patientId, [...(byPatient.get(dose.patientId) ?? []), dose]);
  }

  for (const [patientId, doses] of byPatient) {
    const patientName = doses[0]!.patient.name;
    const list = doses.map((d) => ({ medicine: `${d.medicine.name}${d.medicine.strength ? ` ${d.medicine.strength}` : ""}`, time: d.reminder.time }));
    const names = list.map((d) => `${d.medicine} (${d.time})`).join(", ");

    await notify(patientId, {
      type: "MISSED_DOSE",
      title: { en: "Missed dose", bn: "ওষুধ বাদ পড়েছে" },
      message: {
        en: `You have not confirmed: ${names}. Take it now if your doctor allows, or skip it.`,
        bn: `আপনি নিশ্চিত করেননি: ${names}। ডাক্তার অনুমতি দিলে এখন খেয়ে নিন, নয়তো বাদ দিন।`,
      },
      url: "/dashboard",
    });

    const caregivers = await CareLinkModel.listCaregiversOf(patientId);
    for (const { caregiver } of caregivers) {
      if (!caregiver) continue;
      await notify(caregiver.id, {
        type: "MISSED_DOSE",
        title: { en: `⚠️ ${patientName} missed a dose`, bn: `⚠️ ${patientName} ওষুধ খাননি` },
        message: names,
        data: { patientId },
        url: `/dashboard/care/${patientId}`,
      });
      await sendEmail(caregiver.email, emailTemplates.missedDoses(caregiver.name, patientName, list));
      if (caregiver.smsEnabled) {
        await sendSms(
          caregiver.phone,
          caregiver.language === "en" ? `SmartMed: ${patientName} missed ${names}. Please call them.` : `স্মার্টমেড: ${patientName} ওষুধ খাননি — ${names}। একবার ফোন করুন।`,
        );
      }
    }
  }
  return { missed: overdue.length };
}

/** Hourly: warn about cabinet medicines that expire within 7 days (or already expired). */
export async function processExpiryAlerts() {
  const items = await InventoryModel.findExpiringUnalerted(addDays(new Date(), EXPIRY_WARNING_DAYS));
  const byPatient = new Map<string, typeof items>();
  for (const item of items) {
    if (item.patient.status !== "ACTIVE") continue;
    byPatient.set(item.patientId, [...(byPatient.get(item.patientId) ?? []), item]);
  }

  for (const [patientId, list] of byPatient) {
    const patient = list[0]!.patient;
    const rows = list.map((i) => ({
      name: i.name,
      expiry: i.expiryDate.toISOString().slice(0, 10),
      expired: i.expiryDate < new Date(),
    }));
    const who = patient.honorific?.trim() || patient.name.split(" ")[0];
    await notify(patientId, {
      type: "EXPIRY_ALERT",
      title: { en: "⏳ Medicine expiry alert", bn: "⏳ ওষুধের মেয়াদ শেষ হচ্ছে" },
      message: {
        en: rows.map((r) => `${r.name} ${r.expired ? "expired" : "expires"} on ${r.expiry}`).join(", "),
        bn: rows.map((r) => `${r.name} — মেয়াদ ${r.expired ? "শেষ হয়েছে" : "শেষ হবে"} ${r.expiry}`).join(", "),
      },
      speakText:
        patient.language === "en"
          ? `${who}, the medicines ${rows.map((r) => r.name).join(", ")} in your home are expiring. Please do not take them; throw them away safely.`
          : `${who}, আপনার ঘরে থাকা ${rows.map((r) => r.name).join(", ")} ওষুধের মেয়াদ শেষ হয়ে যাচ্ছে। দয়া করে এগুলো খাবেন না, ফেলে দিন।`,
      url: "/dashboard/cabinet",
    });
    await sendEmail(patient.email, emailTemplates.expiryAlert(patient.name, rows));
    if (patient.smsEnabled) {
      const names = rows.map((r) => `${r.name} (${r.expiry})`).join(", ");
      await sendSms(patient.phone, patient.language === "en" ? `SmartMed: expiring medicine — ${names}. Do not take it.` : `স্মার্টমেড: মেয়াদ শেষ হচ্ছে — ${names}। এই ওষুধ খাবেন না।`);
    }

    const caregivers = await CareLinkModel.listCaregiversOf(patientId);
    for (const { caregiver } of caregivers) {
      if (!caregiver) continue;
      await notify(caregiver.id, {
        type: "EXPIRY_ALERT",
        title: { en: `⏳ ${patient.name}: medicines expiring`, bn: `⏳ ${patient.name}: ওষুধের মেয়াদ শেষ হচ্ছে` },
        message: rows.map((r) => `${r.name} (${r.expiry})`).join(", "),
        data: { patientId },
        url: `/dashboard/care/${patientId}`,
      });
    }
  }
  if (items.length) await InventoryModel.markAlerted(items.map((i) => i.id));
  return { alerted: items.length };
}

/** Daily housekeeping. */
export async function dailyMaintenance() {
  const [plans, courses, sessions, otps] = await Promise.all([
    UserModel.downgradeExpiredPlans(),
    MedicineModel.deactivateFinished(),
    SessionModel.deleteExpired(),
    OtpModel.deleteExpired(),
  ]);
  const result = { downgraded: plans.count, finishedCourses: courses.count, sessions: sessions.count, otps: otps.count };
  logger.info("Daily maintenance:", result);
  return result;
}

export const JOBS = {
  "materialize-doses": { pattern: "5 * * * *", handler: materializeAllPatients },
  "dispatch-reminders": { pattern: "* * * * *", handler: dispatchDueReminders },
  "missed-doses": { pattern: "*/5 * * * *", handler: processMissedDoses },
  "expiry-alerts": { pattern: "15 * * * *", handler: processExpiryAlerts },
  "daily-maintenance": { pattern: "30 3 * * *", handler: dailyMaintenance },
} as const;

export type JobName = keyof typeof JOBS;
