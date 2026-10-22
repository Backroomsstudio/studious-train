-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('DRUM_KIT', 'SAMPLE_PACK', 'VOCAL_PRESET');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDITS', 'CARD');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('HIT_PACKAGE', 'MIX_MASTER', 'FEEDBACK', 'LIVE_SLOT', 'RELEASE');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('OPEN', 'AWAITING_PAYMENT', 'PAID', 'UNSOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditTransactionType" ADD VALUE 'TOPUP';
ALTER TYPE "CreditTransactionType" ADD VALUE 'GIFT_REDEEM';
ALTER TYPE "CreditTransactionType" ADD VALUE 'REFERRAL';
ALTER TYPE "CreditTransactionType" ADD VALUE 'SERVICE';
ALTER TYPE "CreditTransactionType" ADD VALUE 'PRODUCT';

-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "walletAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "lastPausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "walletCredits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contents" TEXT[],
    "producerId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "coverColor" TEXT NOT NULL DEFAULT '#0066ff',
    "previewObjectKey" TEXT,
    "objectKey" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "paidWith" "PaymentMethod" NOT NULL,
    "creditsSpent" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "tierId" TEXT NOT NULL,
    "beatId" TEXT,
    "notes" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "paidWith" "PaymentMethod" NOT NULL,
    "creditsSpent" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "stripeSessionId" TEXT,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "deliveredAt" TIMESTAMP(3),
    "deliveryObjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "startPriceCents" INTEGER NOT NULL,
    "minIncrementCents" INTEGER NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'OPEN',
    "live" BOOLEAN NOT NULL DEFAULT false,
    "winnerId" TEXT,
    "winningBidCents" INTEGER,
    "paymentDueAt" TIMESTAMP(3),
    "skippedUserIds" TEXT[],
    "stripeSessionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "recipientName" TEXT,
    "message" TEXT,
    "purchaserId" TEXT,
    "stripeSessionId" TEXT,
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_published_kind_idx" ON "Product"("published", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPurchase_stripeSessionId_key" ON "ProductPurchase"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPurchase_userId_productId_key" ON "ProductPurchase"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_stripeSessionId_key" ON "ServiceOrder"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ServiceOrder_userId_createdAt_idx" ON "ServiceOrder"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceOrder_kind_status_scheduledFor_idx" ON "ServiceOrder"("kind", "status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_stripeSessionId_key" ON "Auction"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Bid_auctionId_createdAt_idx" ON "Bid"("auctionId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Bid_auctionId_amountCents_key" ON "Bid"("auctionId", "amountCents");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_stripeSessionId_key" ON "GiftCard"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPurchase" ADD CONSTRAINT "ProductPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPurchase" ADD CONSTRAINT "ProductPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Vincoli d'integrità oltre a quelli esprimibili in Prisma
ALTER TABLE "User" ADD CONSTRAINT "User_walletCredits_non_negative" CHECK ("walletCredits" >= 0);
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_window" CHECK ("endsAt" > "startsAt");
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_credits_positive" CHECK ("credits" > 0);
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_discount_range" CHECK ("discountPct" BETWEEN 0 AND 50);
