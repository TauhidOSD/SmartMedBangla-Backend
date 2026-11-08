import { z } from "zod";

export const adminValidator = {
  usersQuery: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(100).optional(),
    role: z.enum(["PATIENT", "CAREGIVER", "ADMIN", "DOCTOR", "PHARMACY"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  }),
  updateUser: z
    .object({
      role: z.enum(["PATIENT", "CAREGIVER", "ADMIN", "DOCTOR", "PHARMACY"]).optional(),
      isProVerified: z.boolean().optional(),
      status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
      plan: z.enum(["FREE", "PREMIUM"]).optional(),
      planExpiresAt: z.coerce.date().nullish(),
    })
    .refine((v) => Object.keys(v).length > 0, "Nothing to update"),
  listQuery: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(100).optional(),
    status: z.string().trim().max(20).optional(),
    feature: z.string().trim().max(40).optional(),
  }),
  broadcast: z.object({
    title: z.string().trim().min(3).max(120),
    message: z.string().trim().min(3).max(500),
    role: z.enum(["PATIENT", "CAREGIVER", "ADMIN", "DOCTOR", "PHARMACY"]).optional(),
  }),
};
