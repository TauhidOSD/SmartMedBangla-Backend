import { z } from "zod";
import { nullableText, optionalDate } from "./common.validator.js";
import { medicineFields, reminderInput } from "./medicine.validator.js";

/** One medicine on a doctor/pharmacy prescription (same shape the patient's medicine form uses). */
export const issuedItem = medicineFields.omit({ startDate: true, endDate: true }).extend({
  reminders: z.array(reminderInput).max(8).default([]),
});

export const issuedValidator = {
  create: z.object({
    patientName: z.string().trim().min(2, "Patient name is required").max(80),
    patientAge: z.coerce.number().int().min(0).max(130).nullish(),
    patientGender: z.enum(["male", "female", "other"]).nullish(),
    patientPhone: nullableText(20),
    diagnosis: nullableText(500),
    advice: nullableText(1000),
    followUpDate: optionalDate,
    imageUrl: z.url().nullish(),
    imagePublicId: z.string().max(255).nullish(),
    items: z.array(issuedItem).min(1, "Add at least one medicine").max(30),
  }),
  listQuery: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    search: z.string().trim().max(100).optional(),
  }),
  send: z.object({ email: z.email("Enter a valid email address").trim().toLowerCase() }),
  codeParam: z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "Invalid prescription code") }),
};

export type IssuedCreateInput = z.infer<typeof issuedValidator.create>;
export type IssuedItem = z.infer<typeof issuedItem>;
