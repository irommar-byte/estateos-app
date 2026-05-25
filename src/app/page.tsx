"use client";
import { useEffect } from "react";
import HeroDepthEffect from "@/components/hero3d/HeroDepthEffect";
import CinematicLoader from "@/components/ui/CinematicLoader";
import { useRouter } from "next/navigation";
import SmoothScroll from "@/components/layout/SmoothScroll";
import GlobalStats from "@/components/home/GlobalStats";
import FeaturedGallery from "@/components/home/FeaturedGallery";
import MarketPulseBar from "@/components/home/MarketPulseBar";
import SignatureHighlights from "@/components/home/SignatureHighlights";
import Footer from "@/components/layout/Footer";
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.hash === "#map") {
      router.replace("/odkryj-mape");
    }
  }, [router]);

  return (
    <>
      <CinematicLoader />
      <SmoothScroll>
        <main className="relative min-h-screen overflow-hidden bg-black text-white selection:bg-emerald-500/30">
          <HeroDepthEffect />
          <div className="relative z-20 bg-black">
            <MarketPulseBar />
          </div>

          <GlobalStats />

          <FeaturedGallery />

          <SignatureHighlights />

          <Footer />
        </main>
      </SmoothScroll>
    </>
  );
}
