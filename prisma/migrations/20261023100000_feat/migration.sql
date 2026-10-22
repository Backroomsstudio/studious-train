-- Cerco feat: bacheca degli annunci di collaborazione, chat private e segnalazioni.

-- CreateEnum
CREATE TYPE "FeatPostStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "FeatPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" VARCHAR(280) NOT NULL,
    "beatId" TEXT,
    "genre" TEXT,
    "city" VARCHAR(40),
    "status" "FeatPostStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FeatPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatThread" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "FeatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "postId" TEXT,
    "messageId" TEXT,
    "reason" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatPost_status_expiresAt_createdAt_idx" ON "FeatPost"("status", "expiresAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeatPost_authorId_createdAt_idx" ON "FeatPost"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeatThread_applicantId_updatedAt_idx" ON "FeatThread"("applicantId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FeatThread_postId_applicantId_key" ON "FeatThread"("postId", "applicantId");

-- CreateIndex
CREATE INDEX "FeatMessage_threadId_createdAt_idx" ON "FeatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatMessage_senderId_createdAt_idx" ON "FeatMessage"("senderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeatReport_createdAt_idx" ON "FeatReport"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "FeatPost" ADD CONSTRAINT "FeatPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatPost" ADD CONSTRAINT "FeatPost_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatThread" ADD CONSTRAINT "FeatThread_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeatPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatThread" ADD CONSTRAINT "FeatThread_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatMessage" ADD CONSTRAINT "FeatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "FeatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatMessage" ADD CONSTRAINT "FeatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatReport" ADD CONSTRAINT "FeatReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatReport" ADD CONSTRAINT "FeatReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeatPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatReport" ADD CONSTRAINT "FeatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "FeatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------------
-- Invarianti (difesa in profondità oltre alla validazione dell'app)
-- ------------------------------------------------------------------
ALTER TABLE "FeatPost" ADD CONSTRAINT "FeatPost_text_not_blank" CHECK (length(btrim("text")) > 0);
ALTER TABLE "FeatPost" ADD CONSTRAINT "FeatPost_window" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "FeatMessage" ADD CONSTRAINT "FeatMessage_body_not_blank" CHECK (length(btrim("body")) > 0);
ALTER TABLE "FeatReport" ADD CONSTRAINT "FeatReport_target" CHECK ("postId" IS NOT NULL OR "messageId" IS NOT NULL);
