/**
 * Social in-app browsers (Facebook, Instagram, …) break pinch-zoom and many web APIs.
 * We try to hand the user off to Safari / Chrome when possible.
 */

const SOCIAL_IAB_RE =
  /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Facebook|Instagram|Line\/|TikTok|BytedanceWebview|LinkedInApp|Snapchat|Twitter|Pinterest|MicroMessenger/i;

const ESCAPE_ATTEMPTED_KEY = "eos_iab_escape_attempted";
const BANNER_DISMISSED_KEY = "eos_iab_banner_dismissed";

export type InAppBrowserContext = {
  isSocialInAppBrowser: boolean;
  isIOS: boolean;
  isAndroid: boolean;
};

export function detectInAppBrowser(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): InAppBrowserContext {
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isSocialInAppBrowser = SOCIAL_IAB_RE.test(ua);
  return { isSocialInAppBrowser, isIOS, isAndroid };
}

/** Android: open current HTTPS URL in Chrome (or system handler). */
export function buildAndroidChromeIntentUrl(href: string): string {
  const url = new URL(href);
  const hostPath = `${url.host}${url.pathname}${url.search}${url.hash}`;
  const fallback = encodeURIComponent(url.toString());
  return `intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/** iOS: Safari custom scheme (works in some IABs; ignored when blocked). */
export function buildIosSafariUrl(href: string): string {
  const url = href.replace(/^https:\/\//i, "x-safari-https://").replace(/^http:\/\//i, "x-safari-http://");
  return url;
}

export function hasAttemptedIabEscape(): boolean {
  try {
    return sessionStorage.getItem(ESCAPE_ATTEMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIabEscapeAttempted(): void {
  try {
    sessionStorage.setItem(ESCAPE_ATTEMPTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isIabBannerDismissed(): boolean {
  try {
    return sessionStorage.getItem(BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissIabBanner(): void {
  try {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Best-effort handoff to the system browser. Returns true if a navigation was started. */
export function openInSystemBrowser(href = typeof window !== "undefined" ? window.location.href : ""): boolean {
  if (!href || typeof window === "undefined") return false;
  const ctx = detectInAppBrowser();
  if (!ctx.isSocialInAppBrowser) return false;

  markIabEscapeAttempted();

  if (ctx.isAndroid) {
    window.location.href = buildAndroidChromeIntentUrl(href);
    return true;
  }

  if (ctx.isIOS) {
    // Primary: Safari scheme (works in some IABs; blocked in others).
    window.location.href = buildIosSafariUrl(href);
    window.setTimeout(() => {
      try {
        if (!detectInAppBrowser().isSocialInAppBrowser) return;
        window.location.href = `googlechrome://navigate?url=${encodeURIComponent(href)}`;
      } catch {
        /* ignore */
      }
    }, 700);
    return true;
  }

  return false;
}
