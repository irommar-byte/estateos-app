"use client";
import { useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/us/app/estateos/id6762899098";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=pl.estateos.app";
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

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={label || "Pobierz EstateOS w App Store"}
        className="inline-flex items-center transition-opacity hover:opacity-90"
      >
        {appleBadgeError ? (
          <span className="inline-flex h-12 items-center rounded-lg bg-black px-4 text-[11px] font-bold text-white">
            <span className="mr-2 text-xl leading-none"></span>
            Pobierz w App Store
          </span>
        ) : (
          <img
            src={APPLE_BADGE_URL}
            alt={label || "Pobierz w App Store"}
            className={compact ? "h-10 w-auto" : "h-12 w-auto"}
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
        className="inline-flex items-center transition-opacity hover:opacity-90"
      >
        {googleBadgeError ? (
          <span className="inline-flex h-12 items-center rounded-lg bg-black px-4 text-[11px] font-bold text-white">
            ▶ Get it on Google Play
          </span>
        ) : (
          <img
            src={GOOGLE_PLAY_BADGE_URL}
            alt="Get it on Google Play"
            className={compact ? "h-11 w-auto" : "h-14 w-auto"}
            loading="lazy"
            onError={() => setGoogleBadgeError(true)}
          />
        )}
      </a>
    </div>
  );
}
