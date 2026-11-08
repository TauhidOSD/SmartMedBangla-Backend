import { prisma } from "../config/prisma.js";

const personSelect = { id: true, name: true, email: true, phone: true, avatarUrl: true } as const;

export const CareLinkModel = {
  isActiveCaregiver: async (patientId: string, caregiverId: string) =>
    (await prisma.careLink.count({ where: { patientId, caregiverId, status: "ACCEPTED" } })) > 0,

  upsertInvite: (patientId: string, inviteEmail: string, relation?: string, caregiverId?: string) =>
    prisma.careLink.upsert({
      where: { patientId_inviteEmail: { patientId, inviteEmail } },
      create: { patientId, inviteEmail, relation, caregiverId },
      update: { status: "PENDING", relation, caregiverId, respondedAt: null },
      include: { patient: { select: personSelect } },
    }),

  findById: (id: string) => prisma.careLink.findUnique({ where: { id } }),

  update: (id: string, data: { status: "ACCEPTED" | "REJECTED" | "REVOKED"; caregiverId?: string }) =>
    prisma.careLink.update({ where: { id }, data: { ...data, respondedAt: new Date() } }),

  listForPatient: (patientId: string) =>
    prisma.careLink.findMany({
      where: { patientId, status: { in: ["PENDING", "ACCEPTED"] } },
      include: { caregiver: { select: personSelect } },
      orderBy: { createdAt: "desc" },
    }),

  countActiveForPatient: (patientId: string) =>
    prisma.careLink.count({ where: { patientId, status: { in: ["PENDING", "ACCEPTED"] } } }),

  listPendingInvitesForEmail: (email: string) =>
    prisma.careLink.findMany({
      where: { inviteEmail: email.toLowerCase(), status: "PENDING" },
      include: { patient: { select: personSelect } },
      orderBy: { createdAt: "desc" },
    }),

  listPatientsForCaregiver: (caregiverId: string) =>
    prisma.careLink.findMany({
      where: { caregiverId, status: "ACCEPTED" },
      include: {
        patient: { select: { ...personSelect, timezone: true, dateOfBirth: true, bloodGroup: true, chronicConditions: true } },
      },
      orderBy: { respondedAt: "desc" },
    }),

  /** Accepted caregivers of a patient – used for missed-dose / expiry alerts. */
  listCaregiversOf: (patientId: string) =>
    prisma.careLink.findMany({
      where: { patientId, status: "ACCEPTED", caregiverId: { not: null } },
      select: { relation: true, caregiver: { select: { id: true, name: true, email: true, phone: true, smsEnabled: true, language: true } } },
    }),
};
