"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Śledzimy tylko widoki frontendu (ignorujemy zaplecza i API w statystykach głównych)
    if (!pathname.startsWith('/api') && !pathname.startsWith('/centrala')) {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname })
      }).catch(() => {});
    }
  }, [pathname]);
  return null;
}
