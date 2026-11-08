/**
 * Doctor / pharmacy → patient prescription hand-off.
 *  - A doctor writes a digital prescription; a pharmacy scans a paper one with AI.
 *  - Each gets an unguessable code printed as a QR code.
 *  - The patient scans it (or receives it by email) and "claims" it: medicines and reminders
 *    are created in their account. Doctor prescriptions are trusted (verified immediately);
 *    pharmacy scans were read by AI, so the patient reviews them first.
 */
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { IssuedPrescriptionModel } from "../models/issuedPrescription.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { randomToken } from "../utils/crypto.js";
import { buildMeta, getPagination } from "../utils/response.js";
import { addDays } from "../utils/time.js";
import type { IssuedCreateInput, IssuedItem } from "../validators/issued.validator.js";
import { emailTemplates } from "../views/emails/templates.js";
import type { ExtractedMedicine } from "./ai/ai.schemas.js";
import { aiService } from "./ai/ai.service.js";
import { getPatientTimezone, materializeDay } from "./dose.service.js";
import { sendEmail } from "./email.service.js";
import { notify } from "./notification.service.js";
import { remindersFor } from "./prescription.service.js";
import { deleteImage, uploadImage } from "./upload.service.js";

const CLAIM_VALID_DAYS = 90;

export const claimUrl = (code: string) => `${env.CLIENT_URL.split(",")[0]!.trim()}/claim/${code}`;

const withUrl = <T extends { code: string }>(rx: T) => ({ ...rx, claimUrl: claimUrl(rx.code) });

function toItem(med: ExtractedMedicine): IssuedItem {
  return {
    name: med.name,
    genericName: med.genericName ?? null,
    strength: med.strength ?? null,
    form: med.form ?? null,
    dosagePattern: med.dosagePattern ?? null,
    instructions: med.instructions ?? null,
    instructionsBn: med.instructionsBn ?? null,
    mealTiming: med.mealTiming,
    durationDays: med.durationDays ?? null,
    reminders: remindersFor(med).map((r) => ({ ...r, daysOfWeek: [], isActive: true })),
  };
}

/** Creates the patient's prescription + medicines + reminders from an issued prescription. */
async function claimFor(patientId: string, code: string) {
  const issued = await IssuedPrescriptionModel.findByCode(code);
  if (!issued) throw ApiError.notFound("Prescription code not found");
  if (issued.claimedAt) {
    if (issued.claimedById === patientId && issued.prescriptionId) return { prescriptionId: issued.prescriptionId, alreadyClaimed: true };
    throw ApiError.conflict("This prescription has already been added to another account");
  }
  if (issued.expiresAt < new Date()) throw ApiError.badRequest("This prescription code has expired");

  const items = issued.items as unknown as IssuedItem[];
  const fromDoctor = issued.source === "DOCTOR";
  const start = new Date();

  const prescription = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.create({
      data: {
        patientId,
        source: issued.source,
        imageUrl: issued.imageUrl,
        title: fromDoctor ? `Dr. ${issued.issuer.name}` : issued.issuer.organization,
        doctorName: fromDoctor ? issued.issuer.name : null,
        hospital: issued.issuer.organization,
        prescribedDate: issued.createdAt,
        diagnosis: issued.diagnosis,
        advice: issued.advice,
        // Doctor prescriptions are typed, not read by AI – no review needed.
        status: fromDoctor ? "VERIFIED" : "PROCESSED",
        aiConfidence: fromDoctor ? 1 : null,
      },
    });
    for (const { reminders, ...med } of items) {
      await tx.medicine.create({
        data: {
          ...med,
          patientId,
          prescriptionId: rx.id,
          startDate: start,
          endDate: med.durationDays ? addDays(start, med.durationDays) : null,
          reminders: {
            create: reminders.map((r) => ({ patientId, time: r.time, quantity: r.quantity, daysOfWeek: r.daysOfWeek, isActive: r.isActive })),
          },
        },
      });
    }
    // Guard against two simultaneous claims: only one update can match `claimedAt: null`.
    const { count } = await tx.issuedPrescription.updateMany({
      where: { id: issued.id, claimedAt: null },
      data: { claimedAt: new Date(), claimedById: patientId, prescriptionId: rx.id },
    });
    if (count === 0) throw ApiError.conflict("This prescription has already been added to another account");
    return rx;
  });

  if (fromDoctor) await materializeDay(patientId, await getPatientTimezone(patientId));
  return { prescriptionId: prescription.id, alreadyClaimed: false };
}

async function getOwned(issuerId: string, id: string) {
  const rx = await IssuedPrescriptionModel.findForIssuer(id, issuerId);
  if (!rx) throw ApiError.notFound("Prescription not found");
  return rx;
}

export const issuedService = {
  async create(issuer: AuthUser, input: IssuedCreateInput) {
    const source = issuer.role === "PHARMACY" ? "PHARMACY" : "DOCTOR";
    const rx = await IssuedPrescriptionModel.create({
      code: randomToken(9),
      issuerId: issuer.id,
      source,
      patientName: input.patientName,
      patientAge: input.patientAge ?? null,
      patientGender: input.patientGender ?? null,
      patientPhone: input.patientPhone ?? null,
      diagnosis: input.diagnosis ?? null,
      advice: input.advice ?? null,
      followUpDate: input.followUpDate ?? null,
      imageUrl: source === "PHARMACY" ? (input.imageUrl ?? null) : null,
      imagePublicId: source === "PHARMACY" ? (input.imagePublicId ?? null) : null,
      items: input.items as unknown as Prisma.InputJsonValue,
      expiresAt: addDays(new Date(), CLAIM_VALID_DAYS),
    });
    return withUrl(rx);
  },

  /** Pharmacy: read a paper prescription with AI so staff can verify and hand it to the customer. */
  async scan(user: AuthUser, file: Express.Multer.File) {
    await aiService.assertScanQuota(user);
    const [stored, { data }] = await Promise.all([
      uploadImage(file.buffer, "prescriptions"),
      aiService.extractPrescription(user.id, { mimeType: file.mimetype, data: file.buffer.toString("base64") }),
    ]);
    if (!data.isPrescription) {
      await deleteImage(stored.publicId);
      throw ApiError.badRequest("This image does not look like a prescription. Please upload a clear photo of the prescription.");
    }
    return {
      imageUrl: stored.url,
      imagePublicId: stored.publicId,
      doctorName: data.doctorName ?? null,
      diagnosis: data.diagnosis ?? null,
      advice: data.advice ?? null,
      summaryBn: data.summaryBn ?? null,
      confidence: data.confidence,
      items: data.medicines.filter((m): m is ExtractedMedicine => m !== null).map(toItem),
    };
  },

  async list(issuer: AuthUser, query: { page?: number; limit?: number; search?: string }) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.IssuedPrescriptionWhereInput = {
      issuerId: issuer.id,
      ...(query.search ? { OR: [{ patientName: { contains: query.search, mode: "insensitive" } }, { diagnosis: { contains: query.search, mode: "insensitive" } }] } : {}),
    };
    const [{ items, total }, stats] = await Promise.all([IssuedPrescriptionModel.list(where, skip, limit), IssuedPrescriptionModel.stats(issuer.id)]);
    return { items: items.map(withUrl), stats, meta: buildMeta(page, limit, total) };
  },

  get: async (issuer: AuthUser, id: string) => withUrl(await getOwned(issuer.id, id)),

  async remove(issuer: AuthUser, id: string) {
    const rx = await getOwned(issuer.id, id);
    if (rx.claimedAt) throw ApiError.badRequest("A prescription that a patient has already added cannot be deleted");
    await IssuedPrescriptionModel.delete(id);
    await deleteImage(rx.imagePublicId);
  },

  /** Public preview shown when a QR code is scanned (the code itself is the secret). */
  async preview(code: string) {
    const rx = await IssuedPrescriptionModel.findByCode(code);
    if (!rx) throw ApiError.notFound("Prescription code not found");
    return {
      code: rx.code,
      source: rx.source,
      issuer: {
        name: rx.issuer.name,
        organization: rx.issuer.organization,
        specialty: rx.issuer.specialty,
        licenseNumber: rx.issuer.licenseNumber,
        isProVerified: rx.issuer.isProVerified,
      },
      patientName: rx.patientName,
      patientAge: rx.patientAge,
      patientGender: rx.patientGender,
      diagnosis: rx.diagnosis,
      advice: rx.advice,
      followUpDate: rx.followUpDate,
      imageUrl: rx.imageUrl,
      items: rx.items as unknown as IssuedItem[],
      createdAt: rx.createdAt,
      expiresAt: rx.expiresAt,
      claimed: Boolean(rx.claimedAt),
      expired: rx.expiresAt < new Date(),
    };
  },

  claim: (patient: AuthUser, code: string) => {
    if (patient.role !== "PATIENT") throw ApiError.forbidden("Only patient accounts can add a prescription");
    return claimFor(patient.id, code);
  },

  /** Doctor/pharmacy sends the prescription to the patient's email: added directly if they already have an account. */
  async sendToPatient(issuer: AuthUser, id: string, email: string) {
    const rx = await getOwned(issuer.id, id);
    if (rx.claimedAt) throw ApiError.badRequest("This prescription has already been added to a patient's account");

    const patient = await UserModel.findByEmail(email);
    if (patient && patient.role === "PATIENT" && patient.status === "ACTIVE") {
      const result = await claimFor(patient.id, rx.code);
      await notify(patient.id, {
        type: "SYSTEM",
        title: { en: "New prescription added", bn: "নতুন প্রেসক্রিপশন যোগ হয়েছে" },
        message: {
          en: `${issuer.name} added a prescription to your account.${rx.source === "PHARMACY" ? " Please review the medicines." : " Reminders are active."}`,
          bn: `${issuer.name} আপনার অ্যাকাউন্টে একটি প্রেসক্রিপশন যোগ করেছেন।${rx.source === "PHARMACY" ? " ওষুধগুলো মিলিয়ে দেখুন।" : " রিমাইন্ডার চালু হয়েছে।"}`,
        },
        url: `/dashboard/prescriptions/${result.prescriptionId}`,
      });
      return { delivered: "account" as const };
    }
    await sendEmail(email, emailTemplates.issuedPrescription(rx.patientName, issuer.name, claimUrl(rx.code)));
    return { delivered: "email" as const };
  },
};
