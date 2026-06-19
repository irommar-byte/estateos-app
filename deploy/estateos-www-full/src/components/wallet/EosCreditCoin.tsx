"use client";

type Props = {
  count: number | null;
  loading?: boolean;
  spinning?: boolean;
  size?: "sm" | "md";
};

export default function EosCreditCoin({ count, loading, spinning, size = "sm" }: Props) {
  const dim = size === "md" ? 44 : 36;
  const label = loading ? "…" : String(Math.max(0, count ?? 0));

  return (
    <div
      className="eos-coin-scene relative flex items-center justify-center"
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      <div className={`eos-coin ${spinning ? "eos-coin-spin" : "eos-coin-idle"}`}>
        <div className="eos-coin-face eos-coin-front">
          <span className="eos-coin-brand">EOS</span>
          <span className="eos-coin-count">{label}</span>
        </div>
        <div className="eos-coin-face eos-coin-back">
          <span className="eos-coin-brand">EOS</span>
          <span className="eos-coin-sub">PLUS</span>
        </div>
        <div className="eos-coin-rim" />
        <div className="eos-coin-shine" />
      </div>

      <style jsx>{`
        .eos-coin-scene {
          perspective: 480px;
        }
        .eos-coin {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
        }
        .eos-coin-idle {
          animation: eosCoinFloat 4.2s ease-in-out infinite;
        }
        .eos-coin-spin {
          animation: eosCoinSpin3d 1.4s cubic-bezier(0.45, 0.05, 0.25, 1) infinite;
        }
        .eos-coin-face {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow:
            inset 0 1px 2px rgba(255, 255, 255, 0.35),
            inset 0 -2px 5px rgba(120, 53, 15, 0.28),
            0 2px 6px rgba(0, 0, 0, 0.22);
        }
        .eos-coin-front {
          transform: translateZ(1.5px);
          background:
            radial-gradient(circle at 32% 28%, #fff9e6 0%, transparent 38%),
            conic-gradient(from 210deg, #fde68a, #eab308, #fbbf24, #ca8a04, #fde68a);
          border: 1px solid rgba(234, 179, 8, 0.55);
        }
        .eos-coin-back {
          transform: rotateY(180deg) translateZ(1.5px);
          background:
            radial-gradient(circle at 35% 30%, #fef3c7 0%, transparent 38%),
            conic-gradient(from 30deg, #eab308, #ca8a04, #facc15, #a16207, #eab308);
          border: 1px solid rgba(202, 138, 4, 0.5);
        }
        .eos-coin-rim {
          position: absolute;
          inset: -0.5px;
          border-radius: 999px;
          transform: translateZ(-0.5px);
          background: linear-gradient(135deg, #92400e, #b45309 45%, #fcd34d 58%, #78350f);
        }
        .eos-coin-shine {
          position: absolute;
          inset: -30%;
          border-radius: 999px;
          background: linear-gradient(
            115deg,
            transparent 44%,
            rgba(255, 255, 255, 0.28) 50%,
            transparent 56%
          );
          transform: translateZ(2px);
          animation: eosCoinShine 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        .eos-coin-brand {
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: #78350f;
          line-height: 1;
        }
        .eos-coin-count {
          margin-top: 1px;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
          color: #451a03;
          font-variant-numeric: tabular-nums;
        }
        .eos-coin-sub {
          margin-top: 1px;
          font-size: 5px;
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #713f12;
        }
        @keyframes eosCoinFloat {
          0%,
          100% {
            transform: translateY(0) rotateX(8deg) rotateY(-6deg);
          }
          50% {
            transform: translateY(-1px) rotateX(9deg) rotateY(6deg);
          }
        }
        @keyframes eosCoinSpin3d {
          0% {
            transform: rotateX(10deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(10deg) rotateY(360deg);
          }
        }
        @keyframes eosCoinShine {
          0%,
          100% {
            opacity: 0.08;
            transform: translateZ(2px) translateX(-12%) rotate(0deg);
          }
          50% {
            opacity: 0.35;
            transform: translateZ(2px) translateX(12%) rotate(4deg);
          }
        }
      `}</style>
    </div>
  );
}
