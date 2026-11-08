import { CareLinkModel } from "../models/careLink.model.js";
import { InventoryModel } from "../models/inventory.model.js";
import { MedicineModel } from "../models/medicine.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { addDays } from "../utils/time.js";
import { emailTemplates } from "../views/emails/templates.js";
import { doseService } from "./dose.service.js";
import { sendEmail } from "./email.service.js";
import { notify } from "./notification.service.js";

const CAREGIVER_LIMIT = { FREE: 2, PREMIUM: 10 } as const;

export const careService = {
  async invite(patient: AuthUser, email: string, relation?: string) {
    if (email === patient.email.toLowerCase()) throw ApiError.badRequest("You cannot invite yourself");

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser && existingUser.role !== "CAREGIVER") {
      throw ApiError.badRequest("This email belongs to a patient or admin account. Ask them to sign up as a caregiver.");
    }
    const activeCount = await CareLinkModel.countActiveForPatient(patient.id);
    if (activeCount >= CAREGIVER_LIMIT[patient.plan]) {
      throw ApiError.paymentRequired(
        patient.plan === "FREE"
          ? `Free plan supports ${CAREGIVER_LIMIT.FREE} caregivers. Upgrade to Premium to add more.`
          : "You have reached the caregiver limit.",
      );
    }

    const link = await CareLinkModel.upsertInvite(patient.id, email, relation);
    await sendEmail(email, emailTemplates.careInvite(patient.name, relation, Boolean(existingUser)));
    if (existingUser) {
      await notify(existingUser.id, {
        type: "CARE_INVITE",
        title: { en: "New caregiver invitation", bn: "নতুন কেয়ারগিভার আমন্ত্রণ" },
        message: {
          en: `${patient.name} invited you to monitor their medicines.`,
          bn: `${patient.name} আপনাকে তার ওষুধের খোঁজ রাখতে আমন্ত্রণ জানিয়েছেন।`,
        },
        url: "/dashboard/care",
      });
    }
    return link;
  },

  listCaregivers: (patientId: string) => CareLinkModel.listForPatient(patientId),

  async revoke(patient: AuthUser, linkId: string) {
    const link = await CareLinkModel.findById(linkId);
    if (!link || link.patientId !== patient.id) throw ApiError.notFound("Caregiver link not found");
    return CareLinkModel.update(linkId, { status: "REVOKED" });
  },

  pendingInvites: (caregiver: AuthUser) => CareLinkModel.listPendingInvitesForEmail(caregiver.email),

  async respond(caregiver: AuthUser, linkId: string, accept: boolean) {
    const link = await CareLinkModel.findById(linkId);
    if (!link || link.inviteEmail !== caregiver.email.toLowerCase() || link.status !== "PENDING") {
      throw ApiError.notFound("Invitation not found");
    }
    const updated = await CareLinkModel.update(linkId, {
      status: accept ? "ACCEPTED" : "REJECTED",
      caregiverId: caregiver.id,
    });
    await notify(link.patientId, {
      type: "CARE_INVITE",
      title: accept ? { en: "Caregiver joined", bn: "কেয়ারগিভার যুক্ত হয়েছেন" } : { en: "Caregiver declined", bn: "কেয়ারগিভার আমন্ত্রণ প্রত্যাখ্যান করেছেন" },
      message: accept
        ? {
            en: `${caregiver.name} accepted your invitation and can now see your medicine schedule.`,
            bn: `${caregiver.name} আপনার আমন্ত্রণ গ্রহণ করেছেন, এখন তিনি আপনার ওষুধের তালিকা দেখতে পাবেন।`,
          }
        : { en: `${caregiver.name} declined your caregiver invitation.`, bn: `${caregiver.name} আপনার আমন্ত্রণ প্রত্যাখ্যান করেছেন।` },
      url: "/dashboard/care",
    });
    return updated;
  },

  /** Caregiver home: every linked patient with today's progress. */
  async patients(caregiver: AuthUser) {
    const links = await CareLinkModel.listPatientsForCaregiver(caregiver.id);
    return Promise.all(
      links.map(async (link) => {
        const today = await doseService.today(link.patient.id);
        return {
          linkId: link.id,
          relation: link.relation,
          patient: link.patient,
          today: today.summary,
          nextDose: today.doses.find((d) => d.id === today.nextDoseId) ?? null,
          missedToday: today.doses.filter((d) => d.status === "MISSED").map((d) => ({
            id: d.id,
            medicine: d.medicine.name,
            time: d.reminder.time,
          })),
        };
      }),
    );
  },

  /** Lets an accepted caregiver set the patient's mobile number and SMS / call alerts. */
  async updatePatientAlerts(caregiver: AuthUser, patientId: string, input: { phone?: string | null; smsEnabled?: boolean; callEnabled?: boolean }) {
    if (!(await CareLinkModel.isActiveCaregiver(patientId, caregiver.id))) {
      throw ApiError.forbidden("You are not a caregiver for this patient");
    }
    const patient = await UserModel.update(patientId, input);
    return { phone: patient.phone, smsEnabled: patient.smsEnabled, callEnabled: patient.callEnabled };
  },

  async patientOverview(caregiver: AuthUser, patientId: string) {
    if (caregiver.role === "CAREGIVER" && !(await CareLinkModel.isActiveCaregiver(patientId, caregiver.id))) {
      throw ApiError.forbidden("You are not a caregiver for this patient");
    }
    const [patient, today, stats, medicines, expiring] = await Promise.all([
      UserModel.findById(patientId),
      doseService.today(patientId),
      doseService.stats(patientId, 7),
      MedicineModel.list(patientId, { active: true }),
      InventoryModel.list(patientId, { isDisposed: false, expiryDate: { lte: addDays(new Date(), 7) } }),
    ]);
    if (!patient) throw ApiError.notFound("Patient not found");
    return {
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        avatarUrl: patient.avatarUrl,
        dateOfBirth: patient.dateOfBirth,
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        chronicConditions: patient.chronicConditions,
        emergencyContact: patient.emergencyContact,
        smsEnabled: patient.smsEnabled,
        callEnabled: patient.callEnabled,
      },
      today,
      weekly: stats,
      medicines,
      expiringItems: expiring,
    };
  },
};
