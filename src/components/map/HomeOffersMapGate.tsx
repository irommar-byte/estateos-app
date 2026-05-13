'use client';

import dynamic from 'next/dynamic';

const HomeOffersMap = dynamic(() => import('@/components/map/HomeOffersMap'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-white/10 bg-black/40 text-sm text-white/50">
      Ładowanie mapy…
    </div>
  ),
});

export default function HomeOffersMapGate() {
  return <HomeOffersMap />;
}
