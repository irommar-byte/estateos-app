import ModeTransition from '@/components/ui/ModeTransition';
import UpgradeModal from '@/components/ui/UpgradeModal';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Tracker from "@/components/Tracker";
import { UserModeProvider } from "@/contexts/UserModeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EstateOS | Ekskluzywne Nieruchomości w Warszawie",
  description: "Odkryj luksusowe apartamenty, wille i penthouse'y. Innowacyjna mapa 3D i oferty bezpośrednio od właścicieli.",
  keywords: ["nieruchomości warszawa", "luksusowe apartamenty", "estateos", "mapa nieruchomości"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="pl">
      <body suppressHydrationWarning className={inter.className}>
        <UserModeProvider>
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
