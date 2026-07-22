import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EstateOS™ — wystaw mieszkanie, dom lub samochód za darmo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function FreeListingOpenGraphImage() {
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
          background: "linear-gradient(145deg, #000000 0%, #0a0f0d 40%, #071018 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 26% 20%, rgba(16,185,129,0.28), transparent 48%), radial-gradient(circle at 78% 70%, rgba(14,165,233,0.22), transparent 45%)",
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
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "white",
            margin: 0,
            textAlign: "center",
            lineHeight: 1.08,
            maxWidth: 1000,
          }}
        >
          Wystaw za darmo mieszkanie, dom lub samochód
        </p>
        <p
          style={{
            marginTop: 22,
            fontSize: 26,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 880,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          Portal ogłoszeń · Home + Car · bez prowizji za publikację
        </p>
      </div>
    ),
    { ...size },
  );
}
