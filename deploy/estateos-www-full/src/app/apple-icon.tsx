import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 72,
            borderRadius: 999,
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.15)",
            gap: 3,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#34d399",
            }}
          />
          <div style={{ display: "flex", fontSize: 38, fontWeight: 900, letterSpacing: -0.3 }}>
            <span style={{ color: "#34d399" }}>E</span>
            <span style={{ color: "#fff" }}>OS</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
