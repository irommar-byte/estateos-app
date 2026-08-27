"use client";

type Props = {
  active?: boolean;
  size?: "sm" | "md";
};

export default function EosSpotlightLens({ active, size = "sm" }: Props) {
  const dim = size === "md" ? 40 : 34;

  return (
    <div
      className="eos-lens-scene relative flex items-center justify-center"
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      <div className={`eos-lens ${active ? "eos-lens-active" : "eos-lens-idle"}`}>
        <div className="eos-lens-rim" />
        <div className="eos-lens-glass">
          <span className="eos-lens-handle" />
          <span className="eos-lens-shine" />
        </div>
      </div>

      <style jsx>{`
        .eos-lens-scene {
          perspective: 520px;
        }
        .eos-lens {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
        }
        .eos-lens-idle {
          animation: eosLensFloat 4.8s ease-in-out infinite;
        }
        .eos-lens-active {
          animation: eosLensPulse 1.1s ease-in-out infinite;
        }
        .eos-lens-rim {
          position: absolute;
          inset: 1px;
          border-radius: 999px;
          background: linear-gradient(145deg, #dbeafe, #93c5fd 42%, #2563eb 72%, #1e3a8a);
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.65),
            0 2px 8px rgba(37, 99, 235, 0.28);
          transform: translateZ(0);
        }
        .eos-lens-glass {
          position: absolute;
          inset: 4px;
          border-radius: 999px;
          overflow: hidden;
          background:
            radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.15) 34%, transparent 58%),
            radial-gradient(circle at 68% 72%, rgba(59, 130, 246, 0.35) 0%, rgba(37, 99, 235, 0.08) 42%, transparent 68%),
            linear-gradient(145deg, rgba(191, 219, 254, 0.55), rgba(59, 130, 246, 0.18));
          border: 1px solid rgba(255, 255, 255, 0.45);
          transform: translateZ(2px);
        }
        .eos-lens-handle {
          position: absolute;
          right: -3px;
          bottom: -3px;
          width: 11px;
          height: 11px;
          border-radius: 999px;
          background: linear-gradient(145deg, #cbd5e1, #64748b);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
          transform: translateZ(1px);
        }
        .eos-lens-shine {
          position: absolute;
          inset: -25%;
          border-radius: 999px;
          background: linear-gradient(
            120deg,
            transparent 42%,
            rgba(255, 255, 255, 0.45) 50%,
            transparent 58%
          );
          animation: eosLensShine 4.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes eosLensFloat {
          0%,
          100% {
            transform: rotateX(10deg) rotateY(-8deg) translateY(0);
          }
          50% {
            transform: rotateX(12deg) rotateY(8deg) translateY(-1px);
          }
        }
        @keyframes eosLensPulse {
          0%,
          100% {
            transform: rotateX(8deg) rotateY(0deg) scale(1);
          }
          50% {
            transform: rotateX(10deg) rotateY(6deg) scale(1.04);
          }
        }
        @keyframes eosLensShine {
          0%,
          100% {
            opacity: 0.1;
            transform: translateX(-14%) rotate(0deg);
          }
          50% {
            opacity: 0.42;
            transform: translateX(14%) rotate(6deg);
          }
        }
      `}</style>
    </div>
  );
}
