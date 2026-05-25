"use client";
import { useEffect } from "react";
import HeroDepthEffect from "@/components/hero3d/HeroDepthEffect";
import InteractiveMap from "@/components/map/InteractiveMap";
import CinematicLoader from "@/components/ui/CinematicLoader";
import SmoothScroll from "@/components/layout/SmoothScroll";
import GlobalStats from "@/components/home/GlobalStats";
import FeaturedGallery from "@/components/home/FeaturedGallery";
import MarketPulseBar from "@/components/home/MarketPulseBar";
import SignatureHighlights from "@/components/home/SignatureHighlights";
import Footer from "@/components/layout/Footer";
import { useLocale } from "@/contexts/LocaleContext";

export default function Home() {
  const { dict } = useLocale();

  useEffect(() => {
    if (window.location.hash === "#map") {
      setTimeout(() => {
        document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500);
    }
  }, []);

  return (
    <>
      <CinematicLoader />
      <SmoothScroll>
        <main className="premium-home-shell relative min-h-screen overflow-hidden bg-[#050505] text-white selection:bg-emerald-500/30">
          <HeroDepthEffect />
          <div className="relative z-20 bg-[#050505]">
            <MarketPulseBar />
          </div>

          <GlobalStats />

          <FeaturedGallery />

          <SignatureHighlights />

          <div
            id="map-section"
            className="premium-home-surface relative z-20 w-full scroll-mt-[6.75rem] border-t border-white/[0.06] bg-black pt-16 shadow-[0_-40px_100px_rgba(0,0,0,0.75)] sm:scroll-mt-24 sm:pt-24"
          >
            <div className="mx-auto mb-12 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400/90">
                {dict.homePremium.mapEyebrow}
              </p>
              <h2 className="premium-home-section-title mt-3 text-4xl font-light tracking-tight text-white sm:text-6xl">
                {dict.homePremium.mapTitle}{" "}
                <span className="font-semibold text-emerald-400">{dict.homePremium.mapTitleHighlight}</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-sm font-light leading-relaxed text-white/50 sm:text-base">
                {dict.homePremium.mapSubtitle}
              </p>
            </div>
            <InteractiveMap />
          </div>

          <Footer />
        </main>
      </SmoothScroll>
    </>
  );
}
