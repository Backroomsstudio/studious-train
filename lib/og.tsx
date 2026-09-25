import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { studio } from "@/lib/studio";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = `${studio.name} – Studio di registrazione a Vicenza: mix, master e incisione professionale`;

async function dataUri(publicPath: string, mime: string): Promise<string> {
  const file = await readFile(join(process.cwd(), "public", publicPath));
  return `data:${mime};base64,${file.toString("base64")}`;
}

/** Immagine di anteprima social (OpenGraph / Twitter) generata al build, 1200×630: foto reale dello studio + logo. */
export async function renderOgImage() {
  const [background, logo] = await Promise.all([
    dataUri("images/og-bg.jpg", "image/jpeg"),
    dataUri("brand/logo-br.png", "image/png"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", color: "#FFFFFF", fontFamily: "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={background} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(90deg, rgba(11,12,16,0.95) 0%, rgba(11,12,16,0.75) 45%, rgba(11,12,16,0.15) 100%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" width={96} height={75} />
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>{studio.name}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, letterSpacing: 8, color: "#45A29E", textTransform: "uppercase" }}>Studio di registrazione · Vicenza</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 68, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
              <span>IL SUONO DI LIVELLO</span>
              <span>MONDIALE, NEL CUORE</span>
              <span style={{ color: "#FFB000" }}>DI VICENZA.</span>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, color: "#C5C6C7" }}>Registrazione · Mix · Mastering · Produzione · Podcast</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
