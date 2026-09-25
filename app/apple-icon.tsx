import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#0B0C10" }}>
        {[34, 78, 120, 66, 92, 44].map((h, i) => (
          <div key={i} style={{ width: 12, height: h, borderRadius: 6, background: i === 2 ? "#FFB000" : "#45A29E" }} />
        ))}
      </div>
    ),
    size,
  );
}
