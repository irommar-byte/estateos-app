"use client";
import { useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/us/app/estateos/id6762899098";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=pl.estateos.app";
const APPLE_BADGE_URL =
  "https://tools.applemediaservices.com/api/badge-download-on-the-app-store/black/en-us?size=250x83";
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
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={label || "Pobierz EstateOS w App Store"}
        className="inline-flex items-center rounded-xl border border-white/12 bg-black/35 p-1 backdrop-blur transition-all hover:border-emerald-400/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.18)]"
      >
        {appleBadgeError ? (
          <span className="inline-flex h-10 items-center rounded-lg bg-black px-4 text-[11px] font-bold text-white">
            <span className="mr-2 text-xl leading-none"></span>
            Download on the App Store
          </span>
        ) : (
          <img
            src={APPLE_BADGE_URL}
            alt={label || "Download on the App Store"}
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
        className="inline-flex items-center rounded-xl border border-white/12 bg-black/35 p-1 backdrop-blur transition-all hover:border-emerald-400/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.18)]"
      >
        {googleBadgeError ? (
          <span className="inline-flex h-10 items-center rounded-lg bg-black px-4 text-[11px] font-bold text-white">
            ▶ Get it on Google Play
          </span>
        ) : (
          <img
            src={GOOGLE_PLAY_BADGE_URL}
            alt="Get it on Google Play"
            className={compact ? "h-10 w-auto" : "h-12 w-auto"}
            loading="lazy"
            onError={() => setGoogleBadgeError(true)}
          />
        )}
      </a>
    </div>
  );
}
