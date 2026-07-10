"use client";

import { useEffect } from "react";
import { useEcosystem } from "@/contexts/EcosystemContext";

/** Synchronizuje `data-ecosystem` na `<html>` — akcenty CSS Home vs Car. */
export default function EcosystemThemeBridge() {
  const { vertical } = useEcosystem();

  useEffect(() => {
    document.documentElement.setAttribute("data-ecosystem", vertical);
    return () => {
      document.documentElement.removeAttribute("data-ecosystem");
    };
  }, [vertical]);

  return null;
}
