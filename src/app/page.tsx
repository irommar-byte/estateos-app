"use client";
import { useEffect } from "react";
import HeroDepthEffect from "@/components/hero3d/HeroDepthEffect";
import InteractiveMap from "@/components/map/InteractiveMap";

export default function Home() {
  // Jeśli ktoś wróci na główną z innej podstrony używając linku "#map", automatycznie przewijamy
  useEffect(() => {
    if (window.location.hash === '#map') {
      setTimeout(() => {
        document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500); // Delikatne opóźnienie, by mapa zdążyła się załadować
    }
  }, []);

  return (
    <main className="bg-black min-h-screen">
      <HeroDepthEffect />
      {/* scroll-mt dobiera offset pod fixed Navbar (różnie na mobile/desktop) */}
      <div id="map-section" className="w-full relative scroll-mt-[6.75rem] sm:scroll-mt-24">
        <InteractiveMap />
      </div>
    </main>
  );
}
