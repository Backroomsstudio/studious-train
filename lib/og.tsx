import { ImageResponse } from "next/og";
import { studio } from "@/lib/studio";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = `${studio.name} – Studio di registrazione a Vicenza: mix, master e incisione professionale`;

const BARS = Array.from({ length: 64 }, (_, i) => {
  const t = i / 63;
  const env = Math.sin(Math.PI * t);
  return Math.max(0.06, env * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.31))));
});

/** Immagine di anteprima social (OpenGraph / Twitter) generata al build, 1200×630. */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(ellipse at 70% 110%, rgba(255,176,0,0.35), rgba(69,162,158,0.15) 40%, #0B0C10 70%)",
          backgroundColor: "#0B0C10",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1F2833", borderRadius: 14, padding: "10px 12px" }}>
              {[10, 22, 32, 18, 26, 12].map((h, i) => (
                <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: i === 2 ? "#FFB000" : "#45A29E" }} />
              ))}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>{studio.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, color: "#FFB000", letterSpacing: 4 }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="#FFB000">
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
            </svg>
            {studio.rating.value.toFixed(1)} GOOGLE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, letterSpacing: 8, color: "#45A29E", textTransform: "uppercase" }}>
            Studio di registrazione · Vicenza
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            <span>IL SUONO DI LIVELLO MONDIALE,</span>
            <span style={{ color: "#FFB000" }}>NEL CUORE DI VICENZA.</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, height: 90 }}>
            {BARS.map((v, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: Math.round(v * 90),
                  borderRadius: 3,
                  background: i > 20 && i < 44 ? "#FFB000" : "#45A29E",
                  opacity: 0.35 + v * 0.65,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#C5C6C7" }}>Registrazione · Mix · Mastering · Produzione</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
