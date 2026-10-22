-- Personalizzazioni dei beat su richiesta, pagate in crediti
-- CreateEnum
CREATE TYPE "CustomizationStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'DELIVERED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'CUSTOMIZATION';

-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "customizationId" TEXT;

-- CreateTable
CREATE TABLE "CustomizationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "options" TEXT[],
    "express" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL,
    "referenceUrl" TEXT,
    "creditsSpent" INTEGER NOT NULL,
    "status" "CustomizationStatus" NOT NULL DEFAULT 'REQUESTED',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "deliveryObjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomizationRequest_userId_createdAt_idx" ON "CustomizationRequest"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CustomizationRequest_status_dueAt_idx" ON "CustomizationRequest"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_customizationId_key" ON "CreditTransaction"("customizationId");

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_customizationId_fkey" FOREIGN KEY ("customizationId") REFERENCES "CustomizationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationRequest" ADD CONSTRAINT "CustomizationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationRequest" ADD CONSTRAINT "CustomizationRequest_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

