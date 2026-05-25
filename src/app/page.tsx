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
        <main className="relative min-h-screen overflow-hidden bg-black text-white selection:bg-emerald-500/30">
          <HeroDepthEffect />
          <div className="relative z-20 bg-black">
            <MarketPulseBar />
          </div>

          <GlobalStats />

          <FeaturedGallery />

          <SignatureHighlights />

          <div
            id="map-section"
            className="relative z-20 w-full scroll-mt-[6.75rem] border-t border-white/10 bg-zinc-950/80 pt-20 backdrop-blur-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:scroll-mt-24 sm:pt-28"
          >
            <div className="mx-auto mb-14 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400">
                {dict.homePremium.mapEyebrow}
              </p>
              <h2 className="mt-4 text-4xl font-light tracking-tight text-white sm:text-6xl">
                {dict.homePremium.mapTitle}{" "}
                <span className="font-semibold text-emerald-400">{dict.homePremium.mapTitleHighlight}</span>
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base font-light leading-relaxed text-zinc-400">
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
