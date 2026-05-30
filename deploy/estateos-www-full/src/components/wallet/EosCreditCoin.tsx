"use client";

type Props = {
  count: number | null;
  loading?: boolean;
  spinning?: boolean;
  size?: "sm" | "md";
};

export default function EosCreditCoin({ count, loading, spinning, size = "sm" }: Props) {
  const dim = size === "md" ? 44 : 38;
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
          perspective: 520px;
        }
        .eos-coin {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .eos-coin-idle {
          animation: eosCoinFloat 3.6s ease-in-out infinite;
        }
        .eos-coin-spin {
          animation: eosCoinSpin3d 1.15s cubic-bezier(0.45, 0.05, 0.25, 1) infinite;
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
            inset 0 2px 4px rgba(255, 255, 255, 0.55),
            inset 0 -3px 8px rgba(120, 53, 15, 0.45),
            0 8px 18px rgba(180, 83, 9, 0.35),
            0 0 24px rgba(251, 191, 36, 0.22);
        }
        .eos-coin-front {
          transform: translateZ(2px);
          background:
            radial-gradient(circle at 30% 25%, #fff7cc 0%, transparent 42%),
            radial-gradient(circle at 70% 78%, rgba(120, 53, 15, 0.35) 0%, transparent 48%),
            conic-gradient(from 210deg, #fde68a, #f59e0b, #fbbf24, #d97706, #fcd34d, #f59e0b);
          border: 1.5px solid rgba(255, 237, 170, 0.85);
        }
        .eos-coin-back {
          transform: rotateY(180deg) translateZ(2px);
          background:
            radial-gradient(circle at 35% 30%, #fef3c7 0%, transparent 40%),
            conic-gradient(from 30deg, #eab308, #ca8a04, #facc15, #a16207, #fde047, #eab308);
          border: 1.5px solid rgba(254, 240, 138, 0.75);
        }
        .eos-coin-rim {
          position: absolute;
          inset: -1px;
          border-radius: 999px;
          transform: translateZ(-1px);
          background: linear-gradient(135deg, #78350f, #b45309 40%, #fcd34d 55%, #92400e);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
        }
        .eos-coin-shine {
          position: absolute;
          inset: -40%;
          border-radius: 999px;
          background: linear-gradient(
            115deg,
            transparent 42%,
            rgba(255, 255, 255, 0.65) 50%,
            transparent 58%
          );
          transform: translateZ(3px);
          animation: eosCoinShine 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        .eos-coin-brand {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.22em;
          color: #78350f;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.45);
          line-height: 1;
        }
        .eos-coin-count {
          margin-top: 1px;
          font-size: 13px;
          font-weight: 900;
          line-height: 1;
          color: #451a03;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
          font-variant-numeric: tabular-nums;
        }
        .eos-coin-sub {
          margin-top: 1px;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: #713f12;
        }
        @keyframes eosCoinFloat {
          0%,
          100% {
            transform: translateY(0) rotateX(10deg) rotateY(-8deg);
          }
          50% {
            transform: translateY(-2px) rotateX(12deg) rotateY(8deg);
          }
        }
        @keyframes eosCoinSpin3d {
          0% {
            transform: rotateX(14deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(14deg) rotateY(360deg);
          }
        }
        @keyframes eosCoinShine {
          0%,
          100% {
            opacity: 0.15;
            transform: translateZ(3px) translateX(-18%) rotate(0deg);
          }
          45% {
            opacity: 0.85;
            transform: translateZ(3px) translateX(18%) rotate(8deg);
          }
        }
      `}</style>
    </div>
  );
}
