"use client";

import { Search } from "lucide-react";

type Props = {
  active?: boolean;
  hovered?: boolean;
  size?: "sm" | "md";
};

export default function EosSpotlightLens({ active, hovered, size = "sm" }: Props) {
  const dim = size === "md" ? 40 : 34;
  const icon = size === "md" ? 17 : 15;

  return (
    <div
      className="eos-lens-scene relative flex items-center justify-center"
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      <div className={`eos-lens ${active ? "eos-lens-active" : hovered ? "eos-lens-hover" : "eos-lens-idle"}`}>
        <div className="eos-lens-handle" />
        <div className="eos-lens-ring" />
        <div className="eos-lens-glass">
          <Search size={icon} strokeWidth={2.35} className="eos-lens-icon" />
          <span className="eos-lens-shine" />
        </div>
      </div>

      <style jsx>{`
        .eos-lens-scene {
          perspective: 640px;
        }
        .eos-lens {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .eos-lens-idle {
          animation: eosLensFloat 5s ease-in-out infinite;
        }
        .eos-lens-hover {
          transform: rotateX(14deg) rotateY(-10deg) scale(1.06);
        }
        .eos-lens-active {
          animation: eosLensSeek 1.05s ease-in-out infinite;
        }
        .eos-lens-ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: linear-gradient(145deg, #e2e8f0, #94a3b8 38%, #64748b 62%, #cbd5e1);
          box-shadow:
            inset 0 1px 2px rgba(255, 255, 255, 0.75),
            0 3px 10px rgba(15, 23, 42, 0.22);
          transform: translateZ(0);
        }
        .eos-lens-glass {
          position: absolute;
          inset: 3px;
          border-radius: 999px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.92) 0%, transparent 42%),
            radial-gradient(circle at 70% 78%, rgba(148, 163, 184, 0.28) 0%, transparent 48%),
            linear-gradient(155deg, rgba(241, 245, 249, 0.92), rgba(148, 163, 184, 0.34));
          border: 1px solid rgba(255, 255, 255, 0.72);
          transform: translateZ(3px);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
        }
        .eos-lens-handle {
          position: absolute;
          right: -2px;
          bottom: -1px;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(145deg, #cbd5e1, #475569);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
          transform: translateZ(1px) rotate(38deg);
        }
        .eos-lens-icon {
          color: #0f172a;
          opacity: 0.82;
          filter: drop-shadow(0 1px 1px rgba(255, 255, 255, 0.65));
        }
        .eos-lens-shine {
          position: absolute;
          inset: -30%;
          border-radius: 999px;
          background: linear-gradient(
            120deg,
            transparent 42%,
            rgba(255, 255, 255, 0.55) 50%,
            transparent 58%
          );
          animation: eosLensShine 4.4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes eosLensFloat {
          0%,
          100% {
            transform: rotateX(8deg) rotateY(-6deg) translateY(0);
          }
          50% {
            transform: rotateX(10deg) rotateY(7deg) translateY(-1px);
          }
        }
        @keyframes eosLensSeek {
          0%,
          100% {
            transform: rotateX(10deg) rotateY(-8deg) scale(1);
          }
          50% {
            transform: rotateX(12deg) rotateY(10deg) scale(1.05);
          }
        }
        @keyframes eosLensShine {
          0%,
          100% {
            opacity: 0.08;
            transform: translateX(-16%) rotate(0deg);
          }
          50% {
            opacity: 0.42;
            transform: translateX(16%) rotate(5deg);
          }
        }
      `}</style>
    </div>
  );
}
