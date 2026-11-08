-- CreateEnum
CREATE TYPE "PrescriptionSource" AS ENUM ('UPLOAD', 'DOCTOR', 'PHARMACY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'DOCTOR';
ALTER TYPE "Role" ADD VALUE 'PHARMACY';

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "source" "PrescriptionSource" NOT NULL DEFAULT 'UPLOAD',
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "callEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialty" TEXT;

-- CreateTable
CREATE TABLE "IssuedPrescription" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "source" "PrescriptionSource" NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "patientPhone" TEXT,
    "diagnosis" TEXT,
    "advice" TEXT,
    "followUpDate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "items" JSONB NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "prescriptionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssuedPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuedPrescription_code_key" ON "IssuedPrescription"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedPrescription_prescriptionId_key" ON "IssuedPrescription"("prescriptionId");

-- CreateIndex
CREATE INDEX "IssuedPrescription_issuerId_createdAt_idx" ON "IssuedPrescription"("issuerId", "createdAt");

-- AddForeignKey
ALTER TABLE "IssuedPrescription" ADD CONSTRAINT "IssuedPrescription_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedPrescription" ADD CONSTRAINT "IssuedPrescription_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

