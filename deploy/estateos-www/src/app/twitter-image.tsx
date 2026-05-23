import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EstateOS - Global Premium Real Estate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #000000 0%, #0a0f0d 45%, #000000 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 20%, rgba(16,185,129,0.25), transparent 50%)",
          }}
        />
        <p
          style={{
            fontSize: 22,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "rgba(52,211,153,0.95)",
            marginBottom: 24,
          }}
        >
          Global Premium Real Estate
        </p>
        <p
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "white",
            margin: 0,
          }}
        >
          <span style={{ color: "#10b981" }}>E</span>state
          <span style={{ color: "#10b981" }}>OS</span>
        </p>
        <p
          style={{
            marginTop: 28,
            fontSize: 28,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 720,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          Intelligent Radar - Verified listings - Live market pulse
        </p>
      </div>
    ),
    { ...size },
  );
}
