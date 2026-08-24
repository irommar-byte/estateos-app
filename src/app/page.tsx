"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import HeroDepthEffect from "@/components/hero3d/HeroDepthEffect";
import SmoothScroll from "@/components/layout/SmoothScroll";
import Footer from "@/components/layout/Footer";
import { useLocale } from "@/contexts/LocaleContext";

const FeaturedGallery = dynamic(() => import("@/components/home/FeaturedGallery"), {
  loading: () => <div className="premium-home-surface min-h-[36vh]" aria-hidden />,
});

const FeaturedCarsGallery = dynamic(() => import("@/components/home/FeaturedCarsGallery"), {
  loading: () => <div className="premium-home-surface min-h-[36vh]" aria-hidden />,
});

const HomeLiveStrip = dynamic(() => import("@/components/home/HomeLiveStrip"));
const EstateOsGuidePanel = dynamic(() => import("@/components/home/EstateOsGuidePanel"));

const InteractiveMap = dynamic(() => import("@/components/map/InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div
      className="mx-auto h-[min(70vh,640px)] w-full max-w-7xl animate-pulse rounded-[1.75rem] bg-[var(--eos-card)]"
      aria-hidden
    />
  ),
});

export default function Home() {
  const { dict } = useLocale();

  useEffect(() => {
    if (window.location.hash === "#map") {
      const t = window.setTimeout(() => {
        document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
      return () => window.clearTimeout(t);
    }
  }, []);

  return (
    <SmoothScroll>
      <main className="premium-home-shell eos-lux-home theme-aware-dashboard relative min-h-screen overflow-x-hidden bg-[var(--eos-bg)] text-[var(--eos-text)] selection:bg-emerald-500/30">
        <HeroDepthEffect />

        <FeaturedGallery />
        <FeaturedCarsGallery />

        <HomeLiveStrip />
        <EstateOsGuidePanel />

        <div
          id="map-section"
          className="premium-home-surface relative z-20 w-full scroll-mt-[6.75rem] border-t border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] pt-16 shadow-[0_-40px_100px_rgba(0,0,0,0.06)] sm:scroll-mt-24 sm:pt-24"
        >
          <div className="mx-auto mb-12 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700/90">
              {dict.homePremium.mapEyebrow}
            </p>
            <h2 className="premium-home-section-title mt-3 text-4xl font-light tracking-tight text-[var(--eos-text)] sm:text-6xl">
              {dict.homePremium.mapTitle}{" "}
              <span className="font-semibold text-emerald-600">{dict.homePremium.mapTitleHighlight}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-light leading-relaxed text-[var(--eos-muted)] sm:text-base">
              {dict.homePremium.mapSubtitle}
            </p>
          </div>
          <InteractiveMap />
        </div>

        <Footer />
      </main>
    </SmoothScroll>
  );
}
