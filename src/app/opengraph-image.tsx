import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og/ogFonts";

export const runtime = "nodejs";
export const alt = "EstateOS™ — wystaw nieruchomość lub auto za darmo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const fonts = await loadOgFonts();
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
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 20%, rgba(16,185,129,0.28), transparent 50%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 76,
            height: 76,
            borderRadius: 999,
            border: "1px solid rgba(52,211,153,0.45)",
            background: "rgba(16,185,129,0.16)",
            marginBottom: 22,
            color: "#34d399",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.06em",
          }}
        >
          EOS
        </div>
        <p
          style={{
            fontSize: 18,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "rgba(52,211,153,0.95)",
            marginBottom: 16,
          }}
        >
          EstateOS™
        </p>
        <p
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "white",
            margin: 0,
            textAlign: "center",
          }}
        >
          <span style={{ color: "#10b981" }}>E</span>state
          <span style={{ color: "#10b981" }}>OS</span>
        </p>
        <p
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 820,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          Wystaw mieszkanie, dom lub samochód za darmo
        </p>
      </div>
    ),
    { ...size, fonts },
  );
}
