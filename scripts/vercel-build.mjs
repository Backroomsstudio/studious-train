/**
 * Build su Vercel: con il database configurato applica le migrazioni e il seed di base
 * (producer, generi, type beat: idempotente, non tocca i profili curati dalla Gestione),
 * poi compila. Senza DATABASE_URL compila e basta (negozio in modalità demo).
 */
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("npx prisma generate");
if (process.env.DATABASE_URL) {
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
} else {
  console.log("DATABASE_URL non impostato: niente migrazioni, build in modalità demo.");
}
run("npx next build");
