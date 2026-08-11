"use client";
import { useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/us/app/estateos/id6762899098";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=pl.estateos.mobile";
const GOOGLE_PLAY_INTERNAL_TEST_URL =
  process.env.NEXT_PUBLIC_ANDROID_INTERNAL_TEST_URL?.trim() ||
  "https://play.google.com/apps/internaltest/4699855385179896044";
const ANDROID_BETA_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ANDROID_BETA_APK_URL?.trim() || "/downloads/estateos-android.apk";
const ANDROID_BETA_FILENAME =
  process.env.NEXT_PUBLIC_ANDROID_BETA_FILENAME?.trim() || "estateos-android.apk";
/** Jawne włączenie APK beta — bez tego Android zostaje na „Wkrótce”. */
const ANDROID_BETA_ENABLED =
  process.env.NEXT_PUBLIC_ANDROID_BETA_ENABLED?.trim() === "1" ||
  process.env.NEXT_PUBLIC_ANDROID_BETA_ENABLED?.trim()?.toLowerCase() === "true";
const APPLE_BADGE_URL = "/badges/app-store-pl-official.png";
const GOOGLE_PLAY_BADGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";

type Props = {
  className?: string;
  compact?: boolean;
  label?: string;
  /** Gdy true (domyślnie): szary, nieklikalny badge Google Play z napisem „Wkrótce”. */
  androidComingSoon?: boolean;
  /** Jawnie włącz pobieranie APK beta (wymaga też ENV lub nadpisuje coming soon). */
  enableAndroidBeta?: boolean;
  androidSoonLabel?: string;
  androidBetaLabel?: string;
  androidBetaBadge?: string;
  showAndroidBetaHint?: boolean;
  androidBetaHint?: string;
};

export default function AppStoreBadgeLink({
  className = "",
  compact = false,
  label,
  androidComingSoon = true,
  enableAndroidBeta = false,
  androidSoonLabel = "Wkrótce",
  androidBetaLabel = "Pobierz na Androida",
  androidBetaBadge = "Beta",
  showAndroidBetaHint = false,
  androidBetaHint = "",
}: Props) {
  const [appleBadgeError, setAppleBadgeError] = useState(false);
  const [googleBadgeError, setGoogleBadgeError] = useState(false);
  const shellClass = compact
    ? "h-[46px] rounded-[12px] px-3"
    : "h-[56px] rounded-[14px] px-4";
  const imageClass = compact ? "h-[28px] w-auto" : "h-[34px] w-auto";
  const badgeShell =
    "group relative inline-flex items-center justify-center overflow-hidden border border-white/55 bg-black/90 shadow-[0_10px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-[1px] hover:border-white hover:bg-black hover:shadow-[0_16px_34px_rgba(0,0,0,0.55),0_0_28px_rgba(16,185,129,0.22)]";
  const comingSoonShell =
    "relative inline-flex cursor-default items-center justify-center overflow-hidden border border-white/20 bg-[#2a2a2a] shadow-none grayscale";
  const fallbackText = compact ? "text-[10px]" : "text-[11px]";
  const useAndroidBeta =
    (enableAndroidBeta || ANDROID_BETA_ENABLED) && Boolean(ANDROID_BETA_DOWNLOAD_URL);
  const showComingSoon = !useAndroidBeta && androidComingSoon;

  const googleBadgeInner = (gray: boolean) =>
    googleBadgeError ? (
      <span
        className={`inline-flex items-center ${fallbackText} font-bold ${gray ? "text-white/55" : "text-white"}`}
      >
        ▶ Get it on Google Play
      </span>
    ) : (
      <img
        src={GOOGLE_PLAY_BADGE_URL}
        alt="Get it on Google Play"
        className={`${imageClass} ${gray ? "opacity-55" : ""}`}
        loading="lazy"
        onError={() => setGoogleBadgeError(true)}
      />
    );

  const androidSlot = (() => {
    if (useAndroidBeta) {
      return (
        <a
          href={ANDROID_BETA_DOWNLOAD_URL}
          download={ANDROID_BETA_FILENAME}
          rel="noopener noreferrer"
          aria-label={`${androidBetaLabel} — ${androidBetaBadge}`}
          className={`${badgeShell} ${shellClass}`}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/35 opacity-80" />
          {googleBadgeInner(false)}
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-black shadow-sm">
            {androidBetaBadge}
          </span>
        </a>
      );
    }

    if (showComingSoon) {
      return (
        <span
          role="img"
          aria-label={`Google Play — ${androidSoonLabel}`}
          title={androidSoonLabel}
          className={`${comingSoonShell} ${shellClass}`}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/15" />
          {googleBadgeInner(true)}
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-neutral-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
            {androidSoonLabel}
          </span>
        </span>
      );
    }

    return (
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Pobierz EstateOS w Google Play"
        className={`${badgeShell} ${shellClass}`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/35 opacity-80" />
        {googleBadgeInner(false)}
      </a>
    );
  })();

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-3">
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
        {androidSlot}
      </div>
      {useAndroidBeta && showAndroidBetaHint && androidBetaHint ? (
        <p className="max-w-md text-center text-[11px] leading-relaxed text-white/55 sm:text-xs">
          {androidBetaHint}{" "}
          <a
            href={GOOGLE_PLAY_INTERNAL_TEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
          >
            test Play
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
