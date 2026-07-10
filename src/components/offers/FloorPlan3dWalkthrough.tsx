'use client';

import { Box } from 'lucide-react';

type FloorPlan3dWalkthroughProps = {
  modelUrl: string;
  locale: string;
};

export default function FloorPlan3dWalkthrough({ modelUrl, locale }: FloorPlan3dWalkthroughProps) {
  const label = locale === 'en' ? '3D walkthrough' : 'Spacer 3D';
  const hint =
    locale === 'en'
      ? 'Open the LiDAR scan in AR Quick Look (Safari on iPhone / iPad).'
      : 'Otwórz skan LiDAR w AR Quick Look (Safari na iPhone / iPad).';

  return (
    <div className="border-t border-[var(--eos-border)] px-6 py-5 md:px-8">
      <a
        rel="ar"
        href={modelUrl}
        className="group flex items-center gap-4 rounded-[1.25rem] border border-sky-400/25 bg-gradient-to-r from-sky-500/10 to-cyan-500/5 px-5 py-4 transition hover:border-sky-300/40 hover:from-sky-500/15"
      >
        <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
          <Box size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-sky-200">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{hint}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-300/80 group-hover:text-sky-200">
          AR
        </span>
      </a>
    </div>
  );
}
