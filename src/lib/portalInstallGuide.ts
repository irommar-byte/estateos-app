import { detectInAppBrowser } from "@/lib/inAppBrowser";

export type PortalInstallSurface = "ios-safari" | "ios-iab" | "android" | "android-iab" | "desktop";

export function isPortalStandalone(
  win: Pick<Window, "matchMedia" | "navigator"> | null | undefined = typeof window === "undefined" ? null : window,
): boolean {
  if (!win) return false;
  return (
    win.matchMedia("(display-mode: standalone)").matches ||
    Boolean((win.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function resolvePortalInstallSurface(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
): PortalInstallSurface {
  const iab = detectInAppBrowser(ua);
  if (iab.isIOS && iab.isSocialInAppBrowser) return "ios-iab";
  if (iab.isAndroid && iab.isSocialInAppBrowser) return "android-iab";
  if (iab.isIOS) return "ios-safari";
  if (iab.isAndroid) return "android";
  return "desktop";
}
