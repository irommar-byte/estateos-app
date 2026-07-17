import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EstateOS™Car — samochody na sprzedaż";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function CarsOpenGraphImage() {
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
          background: "linear-gradient(145deg, #000000 0%, #071018 45%, #000000 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 28% 22%, rgba(14,165,233,0.28), transparent 52%)",
          }}
        />
        <p
          style={{
            fontSize: 22,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "rgba(56,189,248,0.95)",
            marginBottom: 20,
          }}
        >
          EstateOS™Car
        </p>
        <p
          style={{
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "white",
            margin: 0,
            textAlign: "center",
            lineHeight: 1.05,
            maxWidth: 980,
          }}
        >
          Samochody na sprzedaż
        </p>
        <p
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 780,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          Wystaw auto · katalog · Home i Car w jednym koncie
        </p>
      </div>
    ),
    { ...size },
  );
}
