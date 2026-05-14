import ModeTransition from '@/components/ui/ModeTransition';
import UpgradeModal from '@/components/ui/UpgradeModal';
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import SkipToContent from "@/components/layout/SkipToContent";
import Tracker from "@/components/Tracker";
import { UserModeProvider } from "@/contexts/UserModeContext";

export const metadata: Metadata = {
  title: "EstateOS | Ekskluzywne Nieruchomości w Warszawie",
  description: "Odkryj luksusowe apartamenty, wille i penthouse'y. Innowacyjna mapa 3D i oferty bezpośrednio od właścicieli.",
  keywords: ["nieruchomości warszawa", "luksusowe apartamenty", "estateos", "mapa nieruchomości"],
};

/** Safari iOS: safe-area, barwy systemowe; aplikacja jest wyłącznie w trybie ciemnym. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="pl" className="bg-black">
      <body
        suppressHydrationWarning
        className="eos-body min-h-dvh bg-black font-sans text-white antialiased"
      >
        <UserModeProvider>
          <SkipToContent />
          <Tracker />
          <Navbar />
          {children}
        </UserModeProvider>
        <UpgradeModal />
        <ModeTransition />
      </body>
    </html>
  );
}
