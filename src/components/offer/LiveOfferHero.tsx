"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Props = {
  images: string[];
  className?: string;
  disabled?: boolean;
};

/** Ile widać jedno zdjęcie, zanim zacznie przenikać w następne. */
const HOLD_MS = 6500;
/** Długość przenikania — dość długa, żeby wyglądała jak przejście kamery, nie jak przełączenie. */
const FADE_MS = 2600;
/** Ruch kamery trwa cały pobyt zdjęcia na ekranie (z przenikaniem po obu stronach). */
const MOVE_MS = HOLD_MS + FADE_MS * 2;
const MOVES = ["eos-walk-a", "eos-walk-b", "eos-walk-c", "eos-walk-d"] as const;

/** Czeka, aż przeglądarka pobierze i zdekoduje zdjęcie — przenikanie zaczyna się dopiero na gotowym obrazie. */
function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    if (typeof img.decode === "function") {
      img.decode().then(() => resolve(), () => resolve());
    } else {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    }
  });
}

type Layer = { url: string; move: (typeof MOVES)[number]; run: number };

/**
 * „Spacer” po zdjęciach oferty: dwie stałe warstwy, które na zmianę przenikają się,
 * a każde zdjęcie powoli przesuwa się i przybliża jak kamera. Ruch i przenikanie liczy
 * karta graficzna (CSS transform/opacity), więc nie ma przeliczeń w JS co klatkę.
 * Następne zdjęcie jest pobierane i dekodowane zawczasu, a animacja staje, gdy karta
 * jest w tle albo hero zniknie z ekranu.
 */
export default function LiveOfferHero({ images, className, disabled }: Props) {
  const reduce = useReducedMotion();
  const list = useMemo(() => (images || []).map((u) => String(u || "").trim()).filter(Boolean), [images]);
  const listKey = list.join("|");
  const animate = list.length > 1 && !disabled && !reduce;

  const rootRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<[Layer, Layer]>([
    { url: list[0] || "", move: MOVES[0], run: 0 },
    { url: "", move: MOVES[1], run: 0 },
  ]);
  const [front, setFront] = useState<0 | 1>(0);
  const [visible, setVisible] = useState(true);
  const cursorRef = useRef(0);

  useEffect(() => {
    cursorRef.current = 0;
    setFront(0);
    setLayers([
      { url: list[0] || "", move: MOVES[0], run: 0 },
      { url: "", move: MOVES[1], run: 0 },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowa galeria = start od pierwszego zdjęcia
  }, [listKey]);

  // Pauza, gdy karta przeglądarki jest w tle albo hero jest poza ekranem.
  useEffect(() => {
    const el = rootRef.current;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const io = el
      ? new IntersectionObserver(([entry]) => {
          onScreen = entry.isIntersecting;
          update();
        })
      : null;
    if (el && io) io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!animate || !visible) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const nextIndex = (cursorRef.current + 1) % list.length;
      const nextUrl = list[nextIndex]!;
      await preload(nextUrl);
      if (cancelled) return;
      cursorRef.current = nextIndex;
      const back: 0 | 1 = front === 0 ? 1 : 0;
      setLayers((current) => {
        const next: [Layer, Layer] = [current[0], current[1]];
        next[back] = { url: nextUrl, move: MOVES[nextIndex % MOVES.length], run: current[back].run + 1 };
        return next;
      });
      setFront(back);
      // Kolejne zdjęcie pobieramy od razu, żeby przy następnym przejściu było gotowe.
      void preload(list[(nextIndex + 1) % list.length]!);
    }, HOLD_MS + FADE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [animate, visible, front, list]);

  if (!list[0]) {
    return <div className={`absolute inset-0 bg-black ${className || ""}`} aria-hidden />;
  }

  return (
    <div ref={rootRef} className={`absolute inset-0 overflow-hidden bg-black ${className || ""}`} aria-hidden>
      <style>{`
        @keyframes eos-walk-a { from { transform: translate3d(-3%, 0, 0) scale(1.10); } to { transform: translate3d(3%, -1%, 0) scale(1.16); } }
        @keyframes eos-walk-b { from { transform: translate3d(3%, -1%, 0) scale(1.16); } to { transform: translate3d(-3%, 0.5%, 0) scale(1.10); } }
        @keyframes eos-walk-c { from { transform: translate3d(0, 1.5%, 0) scale(1.08); } to { transform: translate3d(-2%, -1.5%, 0) scale(1.18); } }
        @keyframes eos-walk-d { from { transform: translate3d(2%, -1%, 0) scale(1.18); } to { transform: translate3d(0, 1%, 0) scale(1.09); } }
        .eos-walk-layer { position: absolute; inset: 0; transition: opacity ${FADE_MS}ms cubic-bezier(0.45, 0, 0.25, 1); backface-visibility: hidden; }
        .eos-walk-img { position: absolute; inset: -4%; width: 108%; height: 108%; object-fit: cover; will-change: transform; backface-visibility: hidden; }
        @media (prefers-reduced-motion: reduce) { .eos-walk-img { animation: none !important; } }
      `}</style>
      {layers.map((layer, index) =>
        layer.url ? (
          <div key={index} className="eos-walk-layer" style={{ opacity: index === front ? 1 : 0, zIndex: index === front ? 2 : 1 }}>
            {/* Nowy klucz przy każdym zdjęciu restartuje ruch kamery; obraz jest już zdekodowany, więc podmiana jest natychmiastowa. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={layer.run}
              src={layer.url}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority={index === 0 && layer.run === 0 ? "high" : "auto"}
              className={`eos-walk-img ${disabled ? "blur-md" : ""}`}
              style={
                animate
                  ? {
                      animation: `${layer.move} ${MOVE_MS}ms linear both`,
                      animationPlayState: visible ? "running" : "paused",
                    }
                  : { transform: "scale(1.06)" }
              }
            />
          </div>
        ) : null,
      )}
    </div>
  );
}
