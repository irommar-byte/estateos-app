import { detectInAppBrowser } from "@/lib/inAppBrowser";

export type PortalInstallSurface = "ios-safari" | "ios-iab" | "android" | "android-iab" | "desktop";

export type PortalInstallGuide = {
  surface: PortalInstallSurface;
  step1Title: string;
  steps: string[];
  installButton: string;
  needsSafariFirst: boolean;
  pushLockedUntilStandalone: boolean;
};

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

export function portalInstallGuide(surface: PortalInstallSurface): PortalInstallGuide {
  if (surface === "ios-iab") {
    return {
      surface,
      step1Title: "Najpierw otwórz panel w Safari",
      steps: [
        "W przeglądarce Facebooka lub Instagrama nie da się dodać ikony ani włączyć powiadomień.",
        "Kliknij „Otwórz w Safari”, a potem na dole: Udostępnij → Do ekranu początkowego → Dodaj.",
        "Wejdź w panel z nowej ikony na telefonie — dopiero tam włączysz powiadomienia.",
      ],
      installButton: "Otwórz w Safari",
      needsSafariFirst: true,
      pushLockedUntilStandalone: true,
    };
  }

  if (surface === "ios-safari") {
    return {
      surface,
      step1Title: "Dodaj znaczek na ekran telefonu",
      steps: [
        "Na dole ekranu kliknij Udostępnij — kwadrat ze strzałką w górę.",
        "Przewiń listę i wybierz „Do ekranu początkowego”, potem „Dodaj”.",
        "Zamknij Safari i otwórz nową ikonę EstateOS. Dopiero z tej ikony włączysz powiadomienia.",
      ],
      installButton: "Jak dodać znaczek",
      needsSafariFirst: false,
      pushLockedUntilStandalone: true,
    };
  }

  if (surface === "android-iab") {
    return {
      surface,
      step1Title: "Najpierw otwórz panel w Chrome",
      steps: [
        "W Facebooku nie da się dodać ikony. Kliknij „Otwórz w Chrome”.",
        "W Chrome: menu ⋮ → „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.",
        "Otwórz ikonę i dopiero wtedy włącz powiadomienia.",
      ],
      installButton: "Otwórz w Chrome",
      needsSafariFirst: true,
      pushLockedUntilStandalone: false,
    };
  }

  if (surface === "android") {
    return {
      surface,
      step1Title: "Dodaj znaczek na ekran telefonu",
      steps: [
        "W prawym górnym rogu otwórz menu (trzy kropki).",
        "Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.",
        "Otwórz panel z nowej ikony i w kroku 2 włącz powiadomienia.",
      ],
      installButton: "Dodaj na ekran główny",
      needsSafariFirst: false,
      pushLockedUntilStandalone: false,
    };
  }

  return {
    surface,
    step1Title: "Dodaj panel jako aplikację",
    steps: [
      "W pasku adresu kliknij ikonę instalacji albo w menu wybierz „Zainstaluj EstateOS”.",
      "Możesz też od razu włączyć powiadomienia w kroku 2 — na komputerze działają w przeglądarce.",
    ],
    installButton: "Zainstaluj panel",
    needsSafariFirst: false,
    pushLockedUntilStandalone: false,
  };
}

export function canEnablePortalPush(opts: {
  surface: PortalInstallSurface;
  standalone: boolean;
}): boolean {
  if (!opts.standalone && portalInstallGuide(opts.surface).pushLockedUntilStandalone) return false;
  return true;
}
