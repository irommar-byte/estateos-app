"use client";

import { usePathname } from "next/navigation";
import { useEcosystem } from "@/contexts/EcosystemContext";

export default function EcosystemAmbientBackground() {
  const pathname = usePathname() || "";
  const { vertical } = useEcosystem();
  const isCar = pathname.startsWith("/cars") || vertical === "car";

  return (
    <div
      aria-hidden
      className={`eos-ambient-wash ${isCar ? "eos-ambient-wash--car" : "eos-ambient-wash--home"}`}
    />
  );
}
