"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  count: number | null;
  loading?: boolean;
  /** kursor nad monetą: złota rozkręca się, granatowa obraca się na rewers „BIURO” */
  spinning?: boolean;
  size?: "sm" | "md" | "lg";
  /** gold — kredyty osobiste; office — granatowa moneta puli biura */
  variant?: "gold" | "office";
  /** mało kredytów — moneta pulsuje pomarańczową poświatą (sygnał „wymaga uwagi”) */
  alert?: boolean;
};

/** Spoczynek: lekko obrócona na bok — widać rant i grubość, a liczba zostaje czytelna. */
const REST_Y = -26;
const REST_X = 9;
const ACCEL = 1100; // °/s² — rozkręcanie pod kursorem
const MAX_SPEED = 1500; // °/s
const BRAKE = 700; // °/s² — naturalne hamowanie po zabraniu kursora
const SETTLE_MS = 900;
const EDGE_LAYERS = 9;
const STAMP_MS = 1100;

function setTransform(el: HTMLElement | null, angle: number) {
  if (el) el.style.transform = `rotateX(${REST_X}deg) rotateY(${REST_Y + angle}deg)`;
}

/**
 * Złota moneta: pod kursorem przyspiesza i kręci się bez końca, po zabraniu kursora
 * płynnie hamuje dokładnie w pozycji spoczynku, po czym lekko rośnie i błyska połyskiem.
 */
function useGoldSpin(hovered: boolean, enabled: boolean) {
  const coinRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(hovered);
  const [settling, setSettling] = useState(false);
  const state = useRef({ angle: 0, vel: 0, decel: 0, target: 0, raf: 0, last: 0, spun: false });

  useEffect(() => {
    hoverRef.current = hovered;
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const s = state.current;
    if (!hovered && s.vel === 0) return;
    if (!hovered) {
      // Hamowanie ze stałym opóźnieniem tak, by zatrzymać się na pełnym obrocie (liczbą do przodu).
      if (s.vel > 0) {
        const natural = (s.vel * s.vel) / (2 * BRAKE);
        s.target = Math.ceil((s.angle + natural) / 360) * 360;
        s.decel = (s.vel * s.vel) / (2 * Math.max(1, s.target - s.angle));
      }
    }
    if (s.raf) return;

    const tick = (t: number) => {
      const dt = s.last ? Math.min(0.05, (t - s.last) / 1000) : 0;
      s.last = t;
      if (hoverRef.current) {
        s.vel = Math.min(MAX_SPEED, s.vel + ACCEL * dt);
        s.angle += s.vel * dt;
        s.spun = true;
      } else if (s.vel > 0) {
        s.vel = Math.max(0, s.vel - s.decel * dt);
        s.angle = Math.min(s.target, s.angle + s.vel * dt);
        if (s.vel === 0 || s.angle >= s.target) s.vel = 0;
      }
      setTransform(coinRef.current, s.angle % 360);
      if (!hoverRef.current && s.vel === 0) {
        s.angle = 0;
        s.raf = 0;
        s.last = 0;
        setTransform(coinRef.current, 0);
        if (s.spun) {
          s.spun = false;
          setSettling(true);
        }
        return;
      }
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }, [hovered, enabled]);

  useEffect(() => {
    if (!settling) return;
    const t = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [settling]);

  useEffect(() => {
    const s = state.current;
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
    };
  }, []);

  return { coinRef, settling };
}

/**
 * Granatowa moneta: pod kursorem podrywa się i obraca jak rzucona moneta, lądując rewersem „BIURO”.
 * Po zabraniu kursora wraca i „przybija pieczęć”: krótkie dociśnięcie i dwa granatowe kręgi rozchodzące się po blacie.
 */
function useOfficeStamp(hovered: boolean, enabled: boolean) {
  const [stamping, setStamping] = useState(false);
  const wasHovered = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (wasHovered.current && !hovered) {
      setStamping(true);
      const t = window.setTimeout(() => setStamping(false), STAMP_MS);
      wasHovered.current = false;
      return () => window.clearTimeout(t);
    }
    wasHovered.current = hovered;
  }, [hovered, enabled]);
  return stamping;
}

export default function EosCreditCoin({ count, loading, spinning = false, size = "sm", variant = "gold", alert = false }: Props) {
  const dim = size === "lg" ? 76 : size === "md" ? 44 : 36;
  const scale = dim / 36;
  const label = loading ? "…" : String(Math.max(0, count ?? 0));
  const office = variant === "office";
  const { coinRef, settling } = useGoldSpin(spinning, !office);
  const stamping = useOfficeStamp(spinning, office);
  const thick = size === "lg" ? 7.5 : size === "md" ? 4.4 : 3.6;

  return (
    <div
      className={`eos-coin-scene relative flex items-center justify-center ${office ? "is-office" : ""} ${alert ? "is-alert" : ""} ${settling ? "is-settling" : ""} ${office && spinning ? "is-flipped" : ""} ${stamping ? "is-stamp" : ""}`}
      style={{ width: dim, height: dim, ["--coin-t" as string]: `${thick}px`, ["--coin-s" as string]: scale }}
      aria-hidden
    >
      {office ? (
        <>
          <span className="eos-coin-ring" />
          <span className="eos-coin-ring eos-coin-ring--2" />
        </>
      ) : null}
      <div className="eos-coin-float">
        <div ref={coinRef} className="eos-coin">
          {Array.from({ length: EDGE_LAYERS }, (_, i) => (
            <span
              key={i}
              className="eos-coin-edge"
              style={{ transform: `translateZ(calc(var(--coin-t) * ${(i / (EDGE_LAYERS - 1) - 0.5).toFixed(3)}))` }}
            />
          ))}
          <div className="eos-coin-face eos-coin-front">
            <span className="eos-coin-brand">EOS</span>
            <span className="eos-coin-count">{label}</span>
            <span className="eos-coin-gleam" />
          </div>
          <div className="eos-coin-face eos-coin-back">
            <span className="eos-coin-brand">EOS</span>
            <span className="eos-coin-sub">{office ? "BIURO" : "PLUS"}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .eos-coin-scene {
          perspective: 420px;
        }
        .eos-coin-float {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: eosCoinFloat 4.6s ease-in-out infinite;
        }
        .is-settling {
          animation: eosCoinSettle ${SETTLE_MS}ms cubic-bezier(0.34, 1.4, 0.5, 1) both;
        }
        .eos-coin {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transform: rotateX(${REST_X}deg) rotateY(${REST_Y}deg);
        }
        .is-office .eos-coin {
          animation: eosOfficeBack 0.8s cubic-bezier(0.3, 0.9, 0.3, 1) both;
        }
        .is-office.is-flipped .eos-coin {
          animation: eosOfficeToss 1.05s cubic-bezier(0.25, 0.7, 0.3, 1) both;
        }
        .is-office.is-stamp {
          animation: eosOfficeStamp ${STAMP_MS}ms cubic-bezier(0.3, 1.2, 0.4, 1) both;
        }
        .is-office.is-stamp .eos-coin-gleam {
          animation: eosCoinGleam ${STAMP_MS}ms ease-out 0.25s both;
          background: linear-gradient(115deg, transparent 40%, rgba(214, 226, 255, 0.9) 50%, transparent 60%);
        }
        /* Kręgi „pieczęci” rozchodzące się po blacie */
        .eos-coin-ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          border: 1.5px solid rgba(74, 108, 196, 0.9);
          box-shadow: 0 0 10px rgba(74, 108, 196, 0.45);
          opacity: 0;
          transform: scale(0.85);
          pointer-events: none;
        }
        .is-stamp .eos-coin-ring {
          animation: eosOfficeRing 0.9s cubic-bezier(0.2, 0.7, 0.4, 1) 0.18s both;
        }
        .is-stamp .eos-coin-ring--2 {
          animation-delay: 0.36s;
        }

        /* Rant: warstwy krążków tworzą pełną, metaliczną grubość */
        .eos-coin-edge {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: linear-gradient(100deg, #6b3a0c 0%, #b7791f 30%, #f6d68a 50%, #a16207 70%, #5c300a 100%);
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
            inset 0 0 0 1.5px rgba(255, 236, 170, 0.55),
            inset 0 0 0 2.5px rgba(146, 84, 14, 0.35),
            inset 0 1px 2px rgba(255, 255, 255, 0.45),
            inset 0 -2px 5px rgba(120, 53, 15, 0.32);
        }
        .eos-coin-front {
          transform: translateZ(calc(var(--coin-t) / 2 + 0.2px));
          background:
            radial-gradient(circle at 30% 26%, #fffaeb 0%, transparent 40%),
            conic-gradient(from 210deg, #fde68a, #eab308, #fbbf24, #ca8a04, #fde68a);
        }
        .eos-coin-back {
          transform: rotateY(180deg) translateZ(calc(var(--coin-t) / 2 + 0.2px));
          background:
            radial-gradient(circle at 35% 30%, #fef3c7 0%, transparent 38%),
            conic-gradient(from 30deg, #eab308, #ca8a04, #facc15, #a16207, #eab308);
        }
        /* Cień pod monetą — podkreśla głębię */
        .eos-coin-scene::before {
          content: "";
          position: absolute;
          left: 14%;
          right: 14%;
          bottom: -3px;
          height: 5px;
          border-radius: 999px;
          background: radial-gradient(closest-side, rgba(0, 0, 0, 0.28), transparent);
          filter: blur(1px);
          pointer-events: none;
        }

        /* Połysk metaliczny po zatrzymaniu */
        .eos-coin-gleam {
          position: absolute;
          inset: -40%;
          background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.85) 50%, transparent 60%);
          transform: translateX(-75%);
          opacity: 0;
          pointer-events: none;
        }
        .is-settling .eos-coin-gleam {
          animation: eosCoinGleam ${SETTLE_MS}ms ease-out both;
        }

        .eos-coin-brand {
          font-size: calc(6px * var(--coin-s, 1));
          font-weight: 900;
          letter-spacing: 0.2em;
          color: #78350f;
          line-height: 1;
        }
        .eos-coin-count {
          margin-top: 1px;
          font-size: calc(12px * var(--coin-s, 1));
          font-weight: 900;
          line-height: 1;
          color: #451a03;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 1px 0 rgba(255, 244, 205, 0.6);
        }
        .eos-coin-sub {
          margin-top: 1px;
          font-size: calc(5px * var(--coin-s, 1));
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #713f12;
        }

        /* Granatowa moneta biura */
        .is-office .eos-coin-edge {
          background: linear-gradient(100deg, #050f30 0%, #1d3a8a 30%, #b9c9f5 50%, #1a3170 70%, #040c28 100%);
        }
        .is-office .eos-coin-face {
          box-shadow:
            inset 0 0 0 1.5px rgba(205, 219, 255, 0.5),
            inset 0 0 0 2.5px rgba(8, 20, 60, 0.4),
            inset 0 1px 2px rgba(255, 255, 255, 0.4),
            inset 0 -2px 5px rgba(8, 20, 60, 0.45);
        }
        .is-office .eos-coin-front {
          background:
            radial-gradient(circle at 30% 26%, #e8eeff 0%, transparent 40%),
            conic-gradient(from 210deg, #a9bdf0, #22408f, #4a6cc4, #142b6b, #a9bdf0);
        }
        .is-office .eos-coin-back {
          background:
            radial-gradient(circle at 35% 30%, #dfe7ff 0%, transparent 38%),
            conic-gradient(from 30deg, #2c4ea6, #142b6b, #5b7bd0, #0c1d4f, #2c4ea6);
        }
        .is-office .eos-coin-brand {
          color: #dbe4ff;
        }
        .is-office .eos-coin-count {
          color: #ffffff;
          text-shadow: 0 1px 1px rgba(8, 20, 60, 0.6);
        }
        .is-office .eos-coin-sub {
          color: #dbe4ff;
        }

        /* Mało kredytów: pomarańczowa poświata płynnie mruga */
        .is-alert::after {
          content: "";
          position: absolute;
          inset: -3px;
          border-radius: 999px;
          box-shadow: 0 0 12px 3px rgba(249, 140, 22, 0.75);
          animation: eosCoinAlert 0.7s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
          pointer-events: none;
        }
        @keyframes eosCoinAlert {
          from {
            opacity: 1;
          }
          to {
            opacity: 0.1;
          }
        }
        @keyframes eosCoinFloat {
          0%,
          100% {
            transform: translateY(0) rotateY(-3deg);
          }
          50% {
            transform: translateY(-1px) rotateY(3deg);
          }
        }
        @keyframes eosOfficeToss {
          0% {
            transform: translateY(0) rotateX(${REST_X}deg) rotateY(${REST_Y}deg);
          }
          35% {
            transform: translateY(-5px) rotateX(${REST_X + 34}deg) rotateY(${REST_Y + 110}deg);
          }
          70% {
            transform: translateY(-1px) rotateX(${REST_X - 12}deg) rotateY(${REST_Y + 205}deg);
          }
          100% {
            transform: translateY(0) rotateX(${REST_X}deg) rotateY(${REST_Y + 180}deg);
          }
        }
        @keyframes eosOfficeBack {
          0% {
            transform: rotateX(${REST_X}deg) rotateY(${REST_Y + 180}deg);
          }
          100% {
            transform: rotateX(${REST_X}deg) rotateY(${REST_Y}deg);
          }
        }
        @keyframes eosOfficeStamp {
          0% {
            transform: scale(1);
          }
          30% {
            transform: scale(0.86) translateY(1.5px);
          }
          55% {
            transform: scale(1.1) translateY(-0.5px);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes eosOfficeRing {
          0% {
            opacity: 0.95;
            transform: scale(0.85);
          }
          100% {
            opacity: 0;
            transform: scale(1.9);
          }
        }
        @keyframes eosCoinSettle {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.14);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes eosCoinGleam {
          0% {
            opacity: 0;
            transform: translateX(-75%);
          }
          15% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(75%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .eos-coin-float,
          .is-settling,
          .is-settling .eos-coin-gleam,
          .is-office .eos-coin,
          .is-office.is-flipped .eos-coin,
          .is-office.is-stamp,
          .is-stamp .eos-coin-ring {
            animation: none;
          }
          .is-office.is-flipped .eos-coin {
            transform: rotateX(${REST_X}deg) rotateY(${REST_Y + 180}deg);
          }
          .is-alert::after {
            animation: none;
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
