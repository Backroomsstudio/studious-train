-- Loop kit tra i prodotti digitali
ALTER TYPE "ProductKind" ADD VALUE 'LOOP_KIT';

-- Lista d'attesa prima del lancio pubblico
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "artistName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");
