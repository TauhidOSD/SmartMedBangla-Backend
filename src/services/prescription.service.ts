import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PrescriptionModel } from "../models/prescription.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { getPagination, buildMeta } from "../utils/response.js";
import { addDays } from "../utils/time.js";
import type { PrescriptionConfirmInput } from "../validators/prescription.validator.js";
import type { ExtractedMedicine, PrescriptionExtraction } from "./ai/ai.schemas.js";
import { aiService } from "./ai/ai.service.js";
import type { AiImage } from "./ai/ai.provider.js";
import { materializeDay, getPatientTimezone } from "./dose.service.js";
import { deleteImage, uploadImage } from "./upload.service.js";

/** Default clock times for Bangladeshi dosage patterns like "1+0+1" when the AI gives none. */
const SLOT_TIMES: Record<number, string[]> = {
  1: ["08:00"],
  2: ["08:00", "21:00"],
  3: ["08:00", "14:00", "21:00"],
  4: ["08:00", "13:00", "18:00", "22:00"],
};

export function remindersFor(med: ExtractedMedicine) {
  if (med.times.length) return med.times.map((time) => ({ time, quantity: med.quantity ?? "1" }));
  const parts = (med.dosagePattern ?? "").split(/[+\-]/).map((p) => p.trim());
  const slots = SLOT_TIMES[parts.length];
  if (!slots) return [{ time: "08:00", quantity: med.quantity ?? "1" }];
  return parts
    .map((qty, i) => ({ time: slots[i]!, quantity: qty }))
    .filter((r) => r.quantity && r.quantity !== "0");
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 1950 ? null : d;
}

/** Persists AI output: metadata on the prescription + draft medicines/reminders awaiting verification. */
async function applyExtraction(prescriptionId: string, patientId: string, extraction: PrescriptionExtraction, startDate: Date) {
  const medicines = extraction.medicines.filter((m): m is ExtractedMedicine => m !== null);

  if (!extraction.isPrescription) {
    return PrescriptionModel.update(prescriptionId, {
      status: "FAILED",
      failureReason: "This image does not look like a prescription. Please upload a clear photo of the prescription.",
      aiConfidence: extraction.confidence,
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.medicine.deleteMany({ where: { prescriptionId } });
    for (const med of medicines) {
      await tx.medicine.create({
        data: {
          patientId,
          prescriptionId,
          name: med.name,
          genericName: med.genericName,
          strength: med.strength,
          form: med.form,
          dosagePattern: med.dosagePattern,
          instructions: med.instructions,
          instructionsBn: med.instructionsBn,
          mealTiming: med.mealTiming,
          durationDays: med.durationDays,
          startDate,
          endDate: med.durationDays ? addDays(startDate, med.durationDays) : null,
          reminders: { create: remindersFor(med).map((r) => ({ ...r, patientId })) },
        },
      });
    }
    return tx.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: "PROCESSED",
        failureReason: null,
        doctorName: extraction.doctorName,
        hospital: extraction.hospital,
        prescribedDate: parseDate(extraction.prescribedDate),
        diagnosis: extraction.diagnosis,
        advice: extraction.advice,
        rawText: extraction.rawText,
        aiSummaryBn: extraction.summaryBn,
        aiConfidence: extraction.confidence,
      },
    });
  });
}

async function runExtraction(user: AuthUser, prescriptionId: string, patientId: string, image: AiImage) {
  try {
    const { data } = await aiService.extractPrescription(user.id, image);
    await applyExtraction(prescriptionId, patientId, data, new Date());
  } catch (err) {
    // Graceful degradation: keep the uploaded image so the patient can enter medicines manually or retry.
    await PrescriptionModel.update(prescriptionId, {
      status: "FAILED",
      failureReason: err instanceof ApiError ? err.message : "AI processing failed. You can retry or add medicines manually.",
    });
  }
}

async function getOwned(patientId: string, id: string) {
  const prescription = await PrescriptionModel.findForPatient(id, patientId);
  if (!prescription) throw ApiError.notFound("Prescription not found");
  return prescription;
}

export const prescriptionService = {
  async upload(user: AuthUser, patientId: string, file: Express.Multer.File, title?: string | null) {
    await aiService.assertScanQuota(user);
    const image: AiImage = { mimeType: file.mimetype, data: file.buffer.toString("base64") };

    const stored = await uploadImage(file.buffer, "prescriptions");
    const prescription = await PrescriptionModel.create({
      patientId,
      title: title ?? null,
      imageUrl: stored.url,
      imagePublicId: stored.publicId,
      status: "PROCESSING",
    });

    await runExtraction(user, prescription.id, patientId, image);
    return getOwned(patientId, prescription.id);
  },

  async reprocess(user: AuthUser, patientId: string, id: string) {
    const prescription = await getOwned(patientId, id);
    if (prescription.status === "VERIFIED") throw ApiError.badRequest("A verified prescription cannot be re-processed");
    if (!prescription.imageUrl) throw ApiError.badRequest("This prescription has no photo to read");
    await aiService.assertScanQuota(user);

    const res = await fetch(prescription.imageUrl);
    if (!res.ok) throw ApiError.unavailable("Could not load the prescription image");
    const image: AiImage = {
      mimeType: res.headers.get("content-type") ?? "image/jpeg",
      data: Buffer.from(await res.arrayBuffer()).toString("base64"),
    };
    await PrescriptionModel.update(id, { status: "PROCESSING", failureReason: null });
    await runExtraction(user, id, patientId, image);
    return getOwned(patientId, id);
  },

  async list(patientId: string, query: { page?: number; limit?: number; search?: string; status?: Prisma.PrescriptionWhereInput["status"] }) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.PrescriptionWhereInput = {
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { doctorName: { contains: query.search, mode: "insensitive" } },
              { hospital: { contains: query.search, mode: "insensitive" } },
              { diagnosis: { contains: query.search, mode: "insensitive" } },
              { medicines: { some: { name: { contains: query.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const { items, total } = await PrescriptionModel.list(where, skip, limit);
    return { items, meta: buildMeta(page, limit, total) };
  },

  get: getOwned,

  async update(patientId: string, id: string, data: Prisma.PrescriptionUncheckedUpdateInput) {
    await getOwned(patientId, id);
    await PrescriptionModel.update(id, data);
    return getOwned(patientId, id);
  },

  /** Patient reviewed the AI result: replace drafts with the confirmed medicines and start reminders. */
  async confirm(patientId: string, id: string, input: PrescriptionConfirmInput) {
    const prescription = await getOwned(patientId, id);
    if (prescription.status === "VERIFIED") throw ApiError.badRequest("This prescription is already verified");
    if (prescription.status === "PROCESSING") throw ApiError.badRequest("This prescription is still being processed");

    const { medicines, ...metadata } = input;
    await prisma.$transaction(async (tx) => {
      await tx.medicine.deleteMany({ where: { prescriptionId: id } });
      for (const { reminders, ...med } of medicines) {
        const startDate = med.startDate ?? new Date();
        await tx.medicine.create({
          data: {
            ...med,
            patientId,
            prescriptionId: id,
            startDate,
            endDate: med.endDate !== undefined ? med.endDate : med.durationDays ? addDays(startDate, med.durationDays) : null,
            reminders: {
              create: reminders.map((r) => ({ patientId, time: r.time, quantity: r.quantity, daysOfWeek: r.daysOfWeek, isActive: r.isActive })),
            },
          },
        });
      }
      await tx.prescription.update({ where: { id }, data: { ...metadata, status: "VERIFIED", failureReason: null } });
    });

    await materializeDay(patientId, await getPatientTimezone(patientId));
    return getOwned(patientId, id);
  },

  async remove(patientId: string, id: string) {
    const prescription = await getOwned(patientId, id);
    // Unverified drafts would otherwise become "real" medicines once detached.
    if (prescription.status !== "VERIFIED") await prisma.medicine.deleteMany({ where: { prescriptionId: id } });
    await PrescriptionModel.delete(id);
    await deleteImage(prescription.imagePublicId);
  },
};
