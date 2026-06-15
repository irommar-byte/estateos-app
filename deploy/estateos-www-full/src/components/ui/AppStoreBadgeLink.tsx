"use client";
import { useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/us/app/estateos/id6762899098";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=pl.estateos";
const APPLE_BADGE_URL = "/badges/app-store-pl-official.png";
const GOOGLE_PLAY_BADGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";

type Props = {
  className?: string;
  compact?: boolean;
  label?: string;
};

export default function AppStoreBadgeLink({ className = "", compact = false, label }: Props) {
  const [appleBadgeError, setAppleBadgeError] = useState(false);
  const [googleBadgeError, setGoogleBadgeError] = useState(false);
  const shellClass = compact
    ? "h-[46px] rounded-[12px] px-3"
    : "h-[56px] rounded-[14px] px-4";
  const imageClass = compact ? "h-[28px] w-auto" : "h-[34px] w-auto";
  const badgeShell =
    "group relative inline-flex items-center justify-center overflow-hidden border border-white/55 bg-black/90 shadow-[0_10px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-[1px] hover:border-white hover:bg-black hover:shadow-[0_16px_34px_rgba(0,0,0,0.55),0_0_28px_rgba(16,185,129,0.22)]";
  const fallbackText = compact ? "text-[10px]" : "text-[11px]";

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={label || "Pobierz EstateOS w App Store"}
        className={`${badgeShell} ${shellClass}`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/35 opacity-80" />
        {appleBadgeError ? (
          <span className={`inline-flex items-center ${fallbackText} font-bold text-white`}>
            <span className="mr-2 text-xl leading-none"></span>
            Pobierz w App Store
          </span>
        ) : (
          <img
            src={APPLE_BADGE_URL}
            alt={label || "Pobierz w App Store"}
            className={imageClass}
            loading="lazy"
            onError={() => setAppleBadgeError(true)}
          />
        )}
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Pobierz EstateOS w Google Play"
        className={`${badgeShell} ${shellClass}`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/35 opacity-80" />
        {googleBadgeError ? (
          <span className={`inline-flex items-center ${fallbackText} font-bold text-white`}>
            ▶ Get it on Google Play
          </span>
        ) : (
          <img
            src={GOOGLE_PLAY_BADGE_URL}
            alt="Get it on Google Play"
            className={imageClass}
            loading="lazy"
            onError={() => setGoogleBadgeError(true)}
          />
        )}
      </a>
    </div>
  );
}
