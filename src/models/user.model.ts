import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

/** Fields that are safe to send to the client (never the password hash or lockout counters). */
export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  isEmailVerified: true,
  avatarUrl: true,
  language: true,
  largeFont: true,
  voiceEnabled: true,
  timezone: true,
  honorific: true,
  dateOfBirth: true,
  gender: true,
  bloodGroup: true,
  allergies: true,
  chronicConditions: true,
  emergencyContact: true,
  smsEnabled: true,
  callEnabled: true,
  organization: true,
  licenseNumber: true,
  specialty: true,
  address: true,
  isProVerified: true,
  plan: true,
  planExpiresAt: true,
  shareToken: true,
  shareExpiresAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

export const UserModel = {
  findById: (id: string) => prisma.user.findUnique({ where: { id }, select: userPublicSelect }),

  findByIdWithSecrets: (id: string) => prisma.user.findUnique({ where: { id } }),

  findByEmail: (email: string) => prisma.user.findUnique({ where: { email: email.toLowerCase() } }),

  findByShareToken: (shareToken: string) => prisma.user.findUnique({ where: { shareToken } }),

  create: (data: Prisma.UserCreateInput) => prisma.user.create({ data, select: userPublicSelect }),

  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data, select: userPublicSelect }),

  delete: (id: string) => prisma.user.delete({ where: { id } }),

  registerFailedLogin: (id: string, attempts: number, lockedUntil: Date | null) =>
    prisma.user.update({ where: { id }, data: { failedLoginAttempts: attempts, lockedUntil } }),

  registerSuccessfulLogin: (id: string) =>
    prisma.user.update({ where: { id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } }),

  list: async (where: Prisma.UserWhereInput, skip: number, take: number) => {
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          ...userPublicSelect,
          _count: { select: { prescriptions: true, medicines: true, patientLinks: true, caregiverLinks: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  /** Patients that currently have at least one active reminder (used by background jobs). */
  findPatientsWithActiveReminders: () =>
    prisma.user.findMany({
      where: { status: "ACTIVE", reminders: { some: { isActive: true, medicine: { isActive: true } } } },
      select: { id: true, timezone: true },
    }),

  downgradeExpiredPlans: () =>
    prisma.user.updateMany({
      where: { plan: "PREMIUM", planExpiresAt: { lt: new Date() } },
      data: { plan: "FREE" },
    }),
};
