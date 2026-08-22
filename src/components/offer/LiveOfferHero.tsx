"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { OfferImageMetaPublic } from "@/lib/upload/offerImageMeta";
import { OfferAdaptiveImage } from "@/components/offer/OfferAdaptiveImage";

type Props = {
  images: string[];
  className?: string;
  disabled?: boolean;
  imageMeta?: Record<string, OfferImageMetaPublic>;
};

const CYCLE_S = 22;

const IMG_COVER = "h-full w-full object-cover object-center";

/**
 * Wolny pan + crossfade — warstwy oparte o OfferAdaptiveImage (HDR master / SDR fallback).
 */
export default function LiveOfferHero({ images, className, disabled, imageMeta }: Props) {
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
    return <div className={`absolute inset-0 bg-black ${className || ""}`} aria-hidden />;
  }

  const dim = Boolean(disabled);
  const solo = !multi;

  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${className || ""}`}>
      <HeroLayer
        url={slotA}
        meta={imageMeta?.[slotA]}
        role={solo ? "solo" : aOutgoing ? "out" : "in"}
        cycle={cycle}
        dimmed={dim}
        z={solo || aOutgoing ? 1 : 2}
        layerKey="a"
        priority={solo || aOutgoing}
      />
      {!solo ? (
        <HeroLayer
          url={slotB}
          meta={imageMeta?.[slotB]}
          role={aOutgoing ? "in" : "out"}
          cycle={cycle}
          dimmed={dim}
          z={aOutgoing ? 2 : 1}
          layerKey="b"
          priority={!aOutgoing}
        />
      ) : null}
    </div>
  );
}

function HeroLayer({
  url,
  meta,
  role,
  cycle,
  dimmed,
  z,
  layerKey,
  priority,
}: {
  url: string;
  meta?: OfferImageMetaPublic;
  role: "out" | "in" | "solo";
  cycle: number;
  dimmed: boolean;
  z: number;
  layerKey: string;
  priority: boolean;
}) {
  const isOut = role === "out";
  const isSolo = role === "solo";

  const dimClass = dimmed ? (isSolo ? "opacity-60 blur-xl" : "opacity-55 blur-md") : isSolo ? "opacity-90" : "";

  const imageBlock = (
    <OfferAdaptiveImage
      sdrSrc={url}
      meta={meta || null}
      className="h-full w-full"
      imgClassName={IMG_COVER}
      alt=""
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );

  if (isSolo) {
    return (
      <motion.div
        className={`absolute inset-[-14%] overflow-hidden will-change-transform ${dimClass}`}
        style={{ zIndex: z }}
        animate={
          dimmed
            ? undefined
            : {
                scale: [1.22, 1.3, 1.24],
                x: ["0%", "-6%"],
                y: ["0%", "-1%", "0.4%"],
              }
        }
        transition={dimmed ? undefined : { duration: CYCLE_S, repeat: Infinity, ease: "linear" }}
      >
        {imageBlock}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`absolute inset-[-14%] overflow-hidden will-change-transform ${dimClass}`}
      style={{ zIndex: z }}
      key={`${layerKey}-${cycle}-${isOut ? "out" : "in"}`}
      animate={
        isOut
          ? {
              opacity: dimmed ? 0.55 : [1, 1, 0.38, 0],
              scale: [1.22, 1.3, 1.24],
              x: ["0%", "-12%"],
              y: ["0%", "-1%", "0.4%"],
            }
          : {
              opacity: dimmed ? 0.55 : [0, 0.18, 0.88, 1],
              scale: [1.28, 1.26, 1.22],
              x: ["12%", "0%"],
              y: ["0.4%", "0%"],
            }
      }
      transition={{
        duration: CYCLE_S,
        ease: "linear",
        opacity: dimmed
          ? undefined
          : {
              duration: CYCLE_S,
              ease: "linear",
              times: isOut ? [0, 0.55, 0.8, 1] : [0, 0.48, 0.72, 1],
            },
      }}
    >
      {imageBlock}
    </motion.div>
  );
}
