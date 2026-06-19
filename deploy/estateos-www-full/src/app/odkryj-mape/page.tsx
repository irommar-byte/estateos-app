"use client";

import InteractiveMap from "@/components/map/InteractiveMap";

/** Pełnoekranowa mapa — bez formularzy miasta/dzielnic; tylko HUD nad Mapbox. */
export default function DiscoverMapPage() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+5rem)] z-10 flex flex-col bg-[#0a0a0a]">
      <InteractiveMap immersive />
    </div>
  );
}
