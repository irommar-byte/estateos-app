import ModeTransition from '@/components/ui/ModeTransition';
import UpgradeModal from '@/components/ui/UpgradeModal';
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import FloatingPreferencesDock from "@/components/layout/FloatingPreferencesDock";
import SkipToContent from "@/components/layout/SkipToContent";
import LocaleDocumentMeta from "@/components/layout/LocaleDocumentMeta";
import Tracker from "@/components/Tracker";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UserModeProvider } from "@/contexts/UserModeContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://estateos.pl";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EstateOS™ | Global Premium Real Estate",
    template: "%s | EstateOS™",
  },
  description:
    "Discover, list, and close premium properties worldwide. 3D map, Intelligent Radar, verification, and Passkey.",
  keywords: [
    "premium real estate",
    "global property",
    "estateos",
    "luxury homes",
    "property map",
    "intelligent radar",
  ],
  applicationName: "EstateOS",
  authors: [{ name: "EstateOS" }],
  creator: "EstateOS",
  publisher: "EstateOS",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "EstateOS™",
    title: "EstateOS™ | Global Premium Real Estate",
    description:
      "Discover, list, and close premium properties worldwide. Live market pulse, verified listings, Intelligent Radar.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EstateOS™ | Global Premium Real Estate",
    description:
      "Discover, list, and close premium properties worldwide. Live market pulse & Intelligent Radar.",
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
  alternates: { canonical: SITE_URL },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html suppressHydrationWarning lang={locale} className="dark" data-theme="dark">
      <body suppressHydrationWarning className={inter.className}>
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
            <LocaleDocumentMeta />
            <UserModeProvider>
              <FavoritesProvider>
                <SkipToContent />
                <Tracker />
                <Navbar />
                <FloatingPreferencesDock />
                <div id="main-content" tabIndex={-1} className="outline-none">
                  {children}
                </div>
              </FavoritesProvider>
            </UserModeProvider>
            <UpgradeModal />
            <ModeTransition />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
