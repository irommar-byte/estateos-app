import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
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
            width: 28,
            height: 18,
            borderRadius: 999,
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.15)",
            gap: 3,
          }}
        >
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#34d399",
            }}
          />
          <div style={{ display: "flex", fontSize: 9, fontWeight: 900, letterSpacing: -0.3 }}>
            <span style={{ color: "#34d399" }}>E</span>
            <span style={{ color: "#fff" }}>OS</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
