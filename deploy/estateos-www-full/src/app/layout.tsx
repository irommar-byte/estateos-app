import ModeTransition from '@/components/ui/ModeTransition';
import UpgradeModal from '@/components/ui/UpgradeModal';
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import FloatingPreferencesDock from "@/components/layout/FloatingPreferencesDock";
import WebNotificationPrompt from "@/components/layout/WebNotificationPrompt";
import PresentationFlowOrchestrator from "@/components/presentation/PresentationFlowOrchestrator";
import CampaignAttributionBoundary from "@/components/marketing/CampaignAttributionBoundary";
import EstateOsStructuredData from "@/components/marketing/EstateOsStructuredData";
import SkipToContent from "@/components/layout/SkipToContent";
import LocaleDocumentMeta from "@/components/layout/LocaleDocumentMeta";
import Tracker from "@/components/Tracker";
import { DisplayCurrencyProvider } from "@/contexts/DisplayCurrencyContext";
import { FxRateProvider } from "@/contexts/FxRateContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ThemeInitScript, ThemeProvider } from "@/contexts/ThemeContext";
import { UserModeProvider } from "@/contexts/UserModeContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { EcosystemProvider } from "@/contexts/EcosystemContext";
import EcosystemThemeBridge from "@/components/ecosystem/EcosystemThemeBridge";
import EcosystemAmbientBackground from "@/components/ecosystem/EcosystemAmbientBackground";
import EcosystemVerticalTransition from "@/components/ecosystem/EcosystemVerticalTransition";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { ESTATEOS_SITE_URL, ESTATEOS_TAGLINE_PL } from "@/lib/estateOsPublicFacts";
import { FREE_LISTING_KEYWORDS } from "@/lib/seo/freeListingContent";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(ESTATEOS_SITE_URL),
  title: {
    default: "EstateOS™ — wystaw nieruchomość lub auto za darmo",
    template: "%s | EstateOS™",
  },
  description:
    "Wystaw mieszkanie, dom lub samochód na sprzedaż za darmo. Portal EstateOS™ — mapa, katalog, weryfikacja i aplikacja. Bez prowizji portalowej za publikację.",
  keywords: [
    ...FREE_LISTING_KEYWORDS,
    "nieruchomości",
    "estateos.pl",
    "CRM agencja nieruchomości",
    "platforma nieruchomości Polska",
    "aplikacja nieruchomości",
    "mapa nieruchomości",
  ],
  applicationName: "EstateOS",
  authors: [{ name: "EstateOS" }],
  creator: "EstateOS",
  publisher: "EstateOS",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: ESTATEOS_SITE_URL,
    siteName: "EstateOS™",
    title: "EstateOS™ — wystaw nieruchomość lub auto za darmo",
    description: ESTATEOS_TAGLINE_PL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "EstateOS™ — wystaw nieruchomość lub auto za darmo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EstateOS™ — wystaw nieruchomość lub auto za darmo",
    description:
      "Portal ogłoszeń: mieszkanie, dom i samochód za darmo. Mapa, weryfikacja, aplikacja mobilna.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  alternates: { canonical: ESTATEOS_SITE_URL },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html suppressHydrationWarning lang={locale}>
      <body suppressHydrationWarning className={inter.className}>
        <EstateOsStructuredData />
        <ThemeInitScript />
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
            <DisplayCurrencyProvider>
              <FxRateProvider>
                <LocaleDocumentMeta />
                <UserModeProvider>
                  <EcosystemProvider>
                    <EcosystemThemeBridge />
                    <EcosystemAmbientBackground />
                    <FavoritesProvider>
                    <SkipToContent />
                    <CampaignAttributionBoundary />
                    <Tracker />
                    <Navbar />
                    <EcosystemVerticalTransition />
                    <FloatingPreferencesDock />
                    <WebNotificationPrompt />
                    <PresentationFlowOrchestrator />
                    <div id="main-content" tabIndex={-1} className="relative z-10 outline-none">
                      {children}
                    </div>
                    </FavoritesProvider>
                  </EcosystemProvider>
                </UserModeProvider>
                <UpgradeModal />
                <ModeTransition />
              </FxRateProvider>
            </DisplayCurrencyProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
