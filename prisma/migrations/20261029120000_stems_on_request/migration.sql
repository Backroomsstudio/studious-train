-- Stems su richiesta: lo staff segna quando li ha mandati in chat privata
ALTER TABLE "License" ADD COLUMN "stemsSentAt" TIMESTAMP(3);
