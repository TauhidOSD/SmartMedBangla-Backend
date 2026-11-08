import { z } from "zod";
import { nullableText, optionalDate } from "./common.validator.js";

const tagList = z.array(z.string().trim().min(1).max(60)).max(30);

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const userValidator = {
  updateProfile: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: nullableText(20),
    dateOfBirth: optionalDate,
    gender: z.enum(["male", "female", "other"]).nullish(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullish(),
    allergies: tagList.optional(),
    chronicConditions: tagList.optional(),
    emergencyContact: nullableText(120),
    organization: nullableText(160),
    licenseNumber: nullableText(60),
    specialty: nullableText(80),
    address: nullableText(240),
  }),
  updatePreferences: z.object({
    language: z.enum(["bn", "en"]).optional(),
    largeFont: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone").optional(),
    honorific: nullableText(30),
    smsEnabled: z.boolean().optional(),
    callEnabled: z.boolean().optional(),
  }),
  /** Offline alerts can be set by the patient or by an accepted caregiver. */
  alerts: z.object({
    phone: nullableText(20),
    smsEnabled: z.boolean().optional(),
    callEnabled: z.boolean().optional(),
  }),
  shareLink: z.object({ expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]).default(7) }),
  deleteAccount: z.object({ password: z.string().min(1, "Password is required") }),
};
