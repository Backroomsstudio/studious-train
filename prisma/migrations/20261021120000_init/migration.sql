-- Estensione per la ricerca fuzzy (similarità a trigrammi su titoli e nomi)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ARTIST', 'PRODUCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'ELITE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('SUBSCRIPTION_GRANT', 'ROLLOVER_EXPIRY', 'SUBSCRIPTION_END_EXPIRY', 'UNLOCK', 'REFUND', 'ADJUSTMENT', 'BONUS');

-- CreateEnum
CREATE TYPE "BeatStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KeyMode" AS ENUM ('MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "ProducerRole" AS ENUM ('MAIN', 'CO_PRODUCER');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('MP3_LEASE', 'WAV_LEASE', 'TRACKOUT', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "DownloadAsset" AS ENUM ('MP3', 'WAV', 'STEMS');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_STUDIO', 'DELIVERED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "artistName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ARTIST',
    "stripeCustomerId" TEXT,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "idempotencyKey" TEXT,
    "subscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "licenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "instagram" TEXT,
    "isResident" BOOLEAN NOT NULL DEFAULT false,
    "accentColor" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "BeatStatus" NOT NULL DEFAULT 'DRAFT',
    "bpm" INTEGER NOT NULL,
    "keyRoot" INTEGER NOT NULL,
    "keyMode" "KeyMode" NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "moods" TEXT[],
    "coverUrl" TEXT,
    "waveformPeaks" JSONB NOT NULL,
    "previewObjectKey" TEXT NOT NULL,
    "mp3ObjectKey" TEXT NOT NULL,
    "wavObjectKey" TEXT NOT NULL,
    "stemsObjectKey" TEXT,
    "exclusiveAvailable" BOOLEAN NOT NULL DEFAULT true,
    "exclusiveSoldAt" TIMESTAMP(3),
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "searchDocument" TEXT NOT NULL DEFAULT '',
    "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("searchDocument", ''))) STORED,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatProducer" (
    "beatId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "role" "ProducerRole" NOT NULL DEFAULT 'MAIN',
    "splitPct" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "BeatProducer_pkey" PRIMARY KEY ("beatId","producerId")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TypeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyDeal" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "type" "LicenseType" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditsSpent" INTEGER NOT NULL,
    "terms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Download" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "asset" "DownloadAsset" NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beatId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BeatToGenre" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BeatToGenre_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BeatToTypeTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BeatToTypeTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_licenseId_key" ON "CreditTransaction"("licenseId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Producer_slug_key" ON "Producer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_userId_key" ON "Producer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Beat_slug_key" ON "Beat"("slug");

-- CreateIndex
CREATE INDEX "Beat_status_releasedAt_idx" ON "Beat"("status", "releasedAt" DESC);

-- CreateIndex
CREATE INDEX "Beat_bpm_idx" ON "Beat"("bpm");

-- CreateIndex
CREATE INDEX "Beat_keyRoot_keyMode_idx" ON "Beat"("keyRoot", "keyMode");

-- CreateIndex
CREATE INDEX "BeatProducer_producerId_idx" ON "BeatProducer"("producerId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TypeTag_slug_key" ON "TypeTag"("slug");

-- CreateIndex
CREATE INDEX "DailyDeal_startsAt_endsAt_idx" ON "DailyDeal"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "License_userId_createdAt_idx" ON "License"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "License_userId_beatId_type_key" ON "License"("userId", "beatId", "type");

-- CreateIndex
CREATE INDEX "Download_userId_createdAt_idx" ON "Download"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "_BeatToGenre_B_index" ON "_BeatToGenre"("B");

-- CreateIndex
CREATE INDEX "_BeatToTypeTag_B_index" ON "_BeatToTypeTag"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producer" ADD CONSTRAINT "Producer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatProducer" ADD CONSTRAINT "BeatProducer_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatProducer" ADD CONSTRAINT "BeatProducer_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Genre" ADD CONSTRAINT "Genre_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Genre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDeal" ADD CONSTRAINT "DailyDeal_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BeatToGenre" ADD CONSTRAINT "_BeatToGenre_A_fkey" FOREIGN KEY ("A") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BeatToGenre" ADD CONSTRAINT "_BeatToGenre_B_fkey" FOREIGN KEY ("B") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BeatToTypeTag" ADD CONSTRAINT "_BeatToTypeTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BeatToTypeTag" ADD CONSTRAINT "_BeatToTypeTag_B_fkey" FOREIGN KEY ("B") REFERENCES "TypeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------------
-- Ricerca: full-text (tsvector generato) + fuzzy (trigrammi)
-- ------------------------------------------------------------------
CREATE INDEX "Beat_searchVector_idx" ON "Beat" USING GIN ("searchVector");
CREATE INDEX "Beat_searchDocument_trgm_idx" ON "Beat" USING GIN ("searchDocument" gin_trgm_ops);

-- ------------------------------------------------------------------
-- Invarianti del libro mastro e del catalogo (difesa in profondità)
-- ------------------------------------------------------------------
ALTER TABLE "User" ADD CONSTRAINT "User_creditBalance_non_negative" CHECK ("creditBalance" >= 0);
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_balanceAfter_non_negative" CHECK ("balanceAfter" >= 0);
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_amount_non_zero" CHECK ("amount" <> 0);
ALTER TABLE "Beat" ADD CONSTRAINT "Beat_keyRoot_range" CHECK ("keyRoot" BETWEEN 0 AND 11);
ALTER TABLE "Beat" ADD CONSTRAINT "Beat_bpm_range" CHECK ("bpm" BETWEEN 40 AND 250);
ALTER TABLE "BeatProducer" ADD CONSTRAINT "BeatProducer_splitPct_range" CHECK ("splitPct" BETWEEN 0 AND 100);
ALTER TABLE "DailyDeal" ADD CONSTRAINT "DailyDeal_discountPct_range" CHECK ("discountPct" BETWEEN 1 AND 90);
ALTER TABLE "DailyDeal" ADD CONSTRAINT "DailyDeal_window" CHECK ("endsAt" > "startsAt");
