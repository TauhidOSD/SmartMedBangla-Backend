import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import type { DoseStatus } from "../generated/prisma/enums.js";

const doseInclude = {
  medicine: { select: { id: true, name: true, strength: true, form: true, mealTiming: true, instructions: true, instructionsBn: true } },
  reminder: { select: { id: true, time: true, quantity: true } },
} satisfies Prisma.DoseLogInclude;

export type DoseWithMedicine = Prisma.DoseLogGetPayload<{ include: typeof doseInclude }>;

export const DoseLogModel = {
  createMany: (data: Prisma.DoseLogCreateManyInput[]) => prisma.doseLog.createMany({ data, skipDuplicates: true }),

  listInRange: (patientId: string, from: Date, to: Date) =>
    prisma.doseLog.findMany({
      where: { patientId, scheduledFor: { gte: from, lt: to } },
      include: doseInclude,
      orderBy: { scheduledFor: "asc" },
    }),

  findForPatient: (id: string, patientId: string) => prisma.doseLog.findFirst({ where: { id, patientId } }),

  updateStatus: (id: string, status: DoseStatus) =>
    prisma.doseLog.update({
      where: { id },
      data: { status, takenAt: status === "TAKEN" ? new Date() : null },
      include: doseInclude,
    }),

  /** Due doses that have not been announced yet. */
  findDueUnnotified: (now: Date, notOlderThan: Date) =>
    prisma.doseLog.findMany({
      where: { status: "PENDING", notifiedAt: null, scheduledFor: { lte: now, gte: notOlderThan } },
      include: {
        ...doseInclude,
        patient: {
          select: { id: true, name: true, honorific: true, voiceEnabled: true, language: true, status: true, phone: true, smsEnabled: true, callEnabled: true },
        },
      },
      take: 500,
    }),

  markNotified: (ids: string[]) => prisma.doseLog.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: new Date() } }),

  findOverduePending: (before: Date) =>
    prisma.doseLog.findMany({
      where: { status: "PENDING", scheduledFor: { lt: before } },
      include: {
        medicine: { select: { name: true, strength: true } },
        reminder: { select: { time: true } },
        patient: { select: { id: true, name: true, timezone: true, status: true } },
      },
      take: 1000,
    }),

  markMissed: (ids: string[]) =>
    prisma.doseLog.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "MISSED", caregiverAlertedAt: new Date() },
    }),

  /** Removes future, still-pending doses so a changed reminder can be re-materialised. */
  deleteFuturePending: (where: Prisma.DoseLogWhereInput) =>
    prisma.doseLog.deleteMany({ where: { ...where, status: "PENDING", scheduledFor: { gt: new Date() } } }),

  groupStatus: (where: Prisma.DoseLogWhereInput) =>
    prisma.doseLog.groupBy({ by: ["status"], where, _count: { _all: true } }),

  listForStats: (patientId: string, from: Date, to: Date) =>
    prisma.doseLog.findMany({
      where: { patientId, scheduledFor: { gte: from, lt: to } },
      select: { scheduledFor: true, status: true, takenAt: true, medicine: { select: { id: true, name: true } } },
      orderBy: { scheduledFor: "asc" },
    }),
};
