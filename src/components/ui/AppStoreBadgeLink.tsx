"use client";

const APP_STORE_URL = "https://apps.apple.com/us/app/estateos/id6762899098";
const APPLE_BADGE_URL =
  "https://tools.applemediaservices.com/api/badge-download-on-the-app-store/black/en-us?size=250x83";

type Props = {
  className?: string;
  compact?: boolean;
  label?: string;
};

export default function AppStoreBadgeLink({ className = "", compact = false, label }: Props) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={label || "Pobierz EstateOS w App Store"}
      className={`inline-flex items-center rounded-xl border border-white/12 bg-black/35 p-1 backdrop-blur transition-all hover:border-emerald-400/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.18)] ${className}`}
    >
      <img
        src={APPLE_BADGE_URL}
        alt={label || "Download on the App Store"}
        className={compact ? "h-10 w-auto" : "h-12 w-auto"}
        loading="lazy"
      />
    </a>
  );
}
