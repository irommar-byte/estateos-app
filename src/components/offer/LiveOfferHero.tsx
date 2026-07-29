"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  images: string[];
  className?: string;
  disabled?: boolean;
};

const CYCLE_S = 22;

/**
 * Wolny pan w lewo + crossfade kolejnego zdjęcia.
 * `bg-cover` + overflow — pionowe bez pustych pasków.
 */
export default function LiveOfferHero({ images, className, disabled }: Props) {
  const reduce = useReducedMotion();
  const list = useMemo(
    () => (images || []).map((u) => String(u || "").trim()).filter(Boolean),
    [images],
  );
  const listKey = list.join("|");
  const multi = list.length > 1 && !disabled && !reduce;

  const [slotA, setSlotA] = useState(list[0] || "");
  const [slotB, setSlotB] = useState(list[1] || list[0] || "");
  const [aOutgoing, setAOutgoing] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    setSlotA(list[0] || "");
    setSlotB(list[1] || list[0] || "");
    setAOutgoing(true);
    setCursor(0);
    setCycle(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on gallery change
  }, [listKey]);

  useEffect(() => {
    if (!multi || !list.length) return;
    const t = window.setTimeout(() => {
      const nextCursor = (cursor + 1) % list.length;
      const upcoming = list[(nextCursor + 1) % list.length]!;
      if (aOutgoing) {
        setSlotA(upcoming);
        setAOutgoing(false);
      } else {
        setSlotB(upcoming);
        setAOutgoing(true);
      }
      setCursor(nextCursor);
      setCycle((c) => c + 1);
    }, CYCLE_S * 1000);
    return () => window.clearTimeout(t);
  }, [multi, cycle, cursor, aOutgoing, list]);

  if (!slotA) {
    return <div className={`absolute inset-0 bg-black ${className || ""}`} />;
  }

  const dim = Boolean(disabled);
  const solo = !multi;

  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${className || ""}`}>
      <Layer
        url={slotA}
        role={solo ? "solo" : aOutgoing ? "out" : "in"}
        cycle={cycle}
        dimmed={dim}
        z={solo || aOutgoing ? 1 : 2}
        layerKey="a"
      />
      {!solo ? (
        <Layer
          url={slotB}
          role={aOutgoing ? "in" : "out"}
          cycle={cycle}
          dimmed={dim}
          z={aOutgoing ? 2 : 1}
          layerKey="b"
        />
      ) : null}
    </div>
  );
}

function Layer({
  url,
  role,
  cycle,
  dimmed,
  z,
  layerKey,
}: {
  url: string;
  role: "out" | "in" | "solo";
  cycle: number;
  dimmed: boolean;
  z: number;
  layerKey: string;
}) {
  const base =
    "absolute inset-[-14%] bg-cover bg-center will-change-transform";

  if (role === "solo") {
    return (
      <motion.div
        className={`${base} ${dimmed ? "opacity-60 blur-xl" : "opacity-80"}`}
        style={{ backgroundImage: `url('${cssUrl(url)}')`, zIndex: z }}
        animate={
          dimmed
            ? undefined
            : {
                scale: [1.22, 1.3, 1.24],
                x: ["0%", "-6%"],
                y: ["0%", "-1%", "0.4%"],
              }
        }
        transition={
          dimmed
            ? undefined
            : { duration: CYCLE_S, repeat: Infinity, ease: "easeInOut" }
        }
      />
    );
  }

  const isOut = role === "out";
  return (
    <motion.div
      className={base}
      style={{
        backgroundImage: `url('${cssUrl(url)}')`,
        zIndex: z,
        opacity: dimmed ? 0.55 : undefined,
        filter: dimmed ? "blur(12px)" : undefined,
      }}
      // Restart keyframes each cycle; stable layerKey keeps the same DOM node identity per slot.
      key={`${layerKey}-${cycle}-${isOut ? "out" : "in"}`}
      initial={false}
      animate={
        isOut
          ? {
              opacity: [1, 1, 0.38, 0],
              scale: [1.22, 1.3, 1.24],
              x: ["0%", "-12%"],
              y: ["0%", "-1%", "0.4%"],
            }
          : {
              opacity: [0, 0.18, 0.88, 1],
              scale: [1.28, 1.26, 1.22],
              x: ["12%", "0%"],
              y: ["0.4%", "0%"],
            }
      }
      transition={{
        duration: CYCLE_S,
        ease: "easeInOut",
        times: isOut ? [0, 0.55, 0.8, 1] : [0, 0.48, 0.72, 1],
      }}
    />
  );
}

function cssUrl(url: string) {
  return String(url).replace(/'/g, "%27");
}
