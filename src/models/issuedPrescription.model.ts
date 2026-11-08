import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export const issuerSelect = {
  id: true,
  name: true,
  role: true,
  organization: true,
  specialty: true,
  licenseNumber: true,
  isProVerified: true,
} satisfies Prisma.UserSelect;

export const IssuedPrescriptionModel = {
  create: (data: Prisma.IssuedPrescriptionUncheckedCreateInput) => prisma.issuedPrescription.create({ data }),

  findForIssuer: (id: string, issuerId: string) =>
    prisma.issuedPrescription.findFirst({
      where: { id, issuerId },
      include: { issuer: { select: issuerSelect }, claimedBy: { select: { id: true, name: true } } },
    }),

  findByCode: (code: string) => prisma.issuedPrescription.findUnique({ where: { code }, include: { issuer: { select: issuerSelect } } }),

  list: async (where: Prisma.IssuedPrescriptionWhereInput, skip: number, take: number) => {
    const [items, total] = await prisma.$transaction([
      prisma.issuedPrescription.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { claimedBy: { select: { id: true, name: true } } },
      }),
      prisma.issuedPrescription.count({ where }),
    ]);
    return { items, total };
  },

  stats: async (issuerId: string) => {
    const [total, claimed] = await prisma.$transaction([
      prisma.issuedPrescription.count({ where: { issuerId } }),
      prisma.issuedPrescription.count({ where: { issuerId, claimedAt: { not: null } } }),
    ]);
    return { total, claimed, pending: total - claimed };
  },

  delete: (id: string) => prisma.issuedPrescription.delete({ where: { id } }),
};
