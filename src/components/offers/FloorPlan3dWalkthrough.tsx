'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Smartphone } from 'lucide-react';
import { resolvePublicAssetUrl } from '@/lib/roomScan/parseFloorPlanScanMeta';
import type { OfferPageCopy } from '@/content/offerPageCopy';

type FloorPlan3dWalkthroughProps = {
  modelUrl: string;
  copy: OfferPageCopy['floorPlanWalkthrough'];
  compact?: boolean;
};


function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isAppleMobile && isSafari;
}

export default function FloorPlan3dWalkthrough({ modelUrl, copy, compact = false }: FloorPlan3dWalkthroughProps) {
  const [ready, setReady] = useState(false);
  const absoluteUrl = useMemo(() => resolvePublicAssetUrl(modelUrl), [modelUrl]);
  const showArLink = isIosSafari();

  useEffect(() => {
    let cancelled = false;
    import('@google/model-viewer')
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!absoluteUrl) return null;

  if (compact) {
    return (
      <div className="mt-3 space-y-2">
        {showArLink ? (
          <a
            rel="ar"
            href={absoluteUrl}
            className="eos-btn eos-btn--car eos-btn--sm"
          >
            <Smartphone size={14} />
            {copy.openAr}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--eos-border)] px-6 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">{copy.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{copy.subtitle}</p>
        </div>
        {showArLink ? (
          <a
            rel="ar"
            href={absoluteUrl}
            className="eos-btn eos-btn--car eos-btn--sm"
          >
            <Smartphone size={13} />
            {copy.openAr}
          </a>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-sky-400/20 bg-[#050505]">
        {ready ? (
          <model-viewer
            src={absoluteUrl}
            ios-src={absoluteUrl}
            ar
            ar-modes="quick-look webxr scene-viewer"
            camera-controls
            touch-action="pan-y"
            loading="lazy"
            reveal="auto"
            interaction-prompt="auto"
            shadow-intensity="0.85"
            environment-image="neutral"
            alt={copy.title}
            className="block h-[min(420px,58vw)] w-full bg-[#0a0a0a]"
          />
        ) : (
          <div className="flex h-[min(320px,50vw)] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
              <Box size={20} />
            </div>
            <p className="text-sm text-[var(--eos-muted)]">{copy.loading}</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--eos-muted)]">
        {showArLink ? copy.iosHint : copy.desktopHint}
      </p>
    </div>
  );
}
