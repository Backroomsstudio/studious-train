-- Accesso con password personale (hash scrypt, mai la password in chiaro)
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
