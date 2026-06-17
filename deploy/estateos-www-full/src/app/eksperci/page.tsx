"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Przekierowanie na katalog agencji `/agencje`. */
export default function EksperciRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/agencje");
  }, [router]);
  return null;
}
