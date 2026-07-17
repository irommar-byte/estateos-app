import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "EstateOS™Car — wystaw auto za darmo. Zastrzeż VIN, kupujący sprawdzi historię i OC.";
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 999,
            border: "1px solid rgba(56,189,248,0.45)",
            background: "rgba(14,165,233,0.16)",
            marginBottom: 24,
            color: "#38bdf8",
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
            color: "rgba(56,189,248,0.95)",
            marginBottom: 16,
          }}
        >
          EstateOS™Car
        </p>
        <p
          style={{
            fontSize: 58,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "white",
            margin: 0,
            textAlign: "center",
            lineHeight: 1.05,
            maxWidth: 980,
          }}
        >
          Wystaw auto za darmo
        </p>
        <p
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: 600,
            color: "rgba(125,211,252,0.95)",
            maxWidth: 920,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Zastrzeż VIN i rejestrację — kupujący i tak sprawdzi historię i OC
        </p>
        <p
          style={{
            marginTop: 16,
            fontSize: 22,
            color: "rgba(255,255,255,0.62)",
            maxWidth: 860,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          Bez ujawniania pełnych danych · skan dowodu · Home i Car w jednym koncie
        </p>
      </div>
    ),
    { ...size },
  );
}
