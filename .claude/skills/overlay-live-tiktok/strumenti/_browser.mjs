// Apre Chromium con Playwright, sia nel cloud (Playwright globale, Chromium in /opt/pw-browsers) sia su un PC normale.
import { existsSync, readdirSync } from "node:fs";

async function caricaPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return await import("/opt/node22/lib/node_modules/playwright/index.mjs");
  }
}

function chromiumLocale() {
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  const cartella = readdirSync(base).find((n) => /^chromium-\d+$/.test(n));
  const exe = cartella && `${base}/${cartella}/chrome-linux/chrome`;
  return exe && existsSync(exe) ? exe : undefined;
}

export async function apriBrowser() {
  const { chromium } = await caricaPlaywright();
  return chromium.launch({ executablePath: chromiumLocale() });
}

// Comando alla regia via API: "nome" oppure "nome={json}".
export async function comando(base, testo) {
  const i = testo.indexOf("=");
  const [nome, corpo] = i < 0 ? [testo, "{}"] : [testo.slice(0, i), testo.slice(i + 1)];
  const r = await fetch(`${base}/api/${nome}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo });
  return `${nome}: ${(await r.text()).slice(0, 140)}`;
}
