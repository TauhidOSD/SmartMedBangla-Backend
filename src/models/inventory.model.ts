import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export const InventoryModel = {
  create: (data: Prisma.InventoryItemUncheckedCreateInput) => prisma.inventoryItem.create({ data }),

  update: (id: string, data: Prisma.InventoryItemUncheckedUpdateInput) => prisma.inventoryItem.update({ where: { id }, data }),

  delete: (id: string) => prisma.inventoryItem.delete({ where: { id } }),

  findForPatient: (id: string, patientId: string) => prisma.inventoryItem.findFirst({ where: { id, patientId } }),

  list: (patientId: string, where: Prisma.InventoryItemWhereInput = {}) =>
    prisma.inventoryItem.findMany({ where: { patientId, ...where }, orderBy: { expiryDate: "asc" } }),

  /** Items expiring before `until` that have not been alerted yet. */
  findExpiringUnalerted: (until: Date) =>
    prisma.inventoryItem.findMany({
      where: { isDisposed: false, expiryAlertSentAt: null, expiryDate: { lte: until } },
      include: { patient: { select: { id: true, name: true, email: true, honorific: true, status: true, language: true, phone: true, smsEnabled: true } } },
      take: 1000,
    }),

  markAlerted: (ids: string[]) =>
    prisma.inventoryItem.updateMany({ where: { id: { in: ids } }, data: { expiryAlertSentAt: new Date() } }),
};
