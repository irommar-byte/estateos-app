"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readCampaignRef } from "@/components/marketing/CampaignAttribution";

export default function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Śledzimy tylko widoki frontendu (ignorujemy zaplecza i API w statystykach głównych)
    if (!pathname.startsWith('/api') && !pathname.startsWith('/centrala')) {
      const campaignRef = readCampaignRef();
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: pathname, campaignRef }),
      }).catch(() => {});
    }
  }, [pathname]);
  return null;
}
