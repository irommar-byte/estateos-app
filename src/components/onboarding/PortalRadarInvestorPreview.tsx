'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radar, Sparkles, Users } from 'lucide-react';
import type { PortalRadarEstimate } from '@/lib/portalOnboarding';
import type { PortalListingPreview } from '@/lib/portalOnboarding';
import type { PortalOnboardingDictionary } from '@/i18n/portalOnboardingDictionary';
import type { Locale } from '@/i18n/config';
import { PORTAL_ONBOARDING_RADAR_ECOSYSTEM } from '@/lib/radarLiveCounter';

export default function PortalRadarInvestorPreview({
  inviteToken,
  preview,
  dict,
  locale: _locale,
}: {
  inviteToken: string;
  preview: PortalListingPreview;
  dict: PortalOnboardingDictionary;
  locale: Locale;
}) {
  const [estimate, setEstimate] = useState<PortalRadarEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/portal-onboarding/radar-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invite: inviteToken,
            city: preview.city,
            district: preview.district,
            price: preview.price,
            area: preview.area,
            rooms: preview.rooms,
            transactionType: preview.transactionType,
            propertyType: preview.propertyType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setEstimate(data.estimate as PortalRadarEstimate);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, preview]);

  const matchCount = estimate?.matchCount ?? 0;
  const highIntent = estimate?.highIntentCount ?? 0;
  const ecosystem =
    estimate?.ecosystemTotal && estimate.ecosystemTotal > 0
      ? estimate.ecosystemTotal
      : PORTAL_ONBOARDING_RADAR_ECOSYSTEM;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="po-radar-preview overflow-hidden rounded-2xl border p-5"
    >
      <div className="flex items-start gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/15" />
          <span className="absolute inset-2 rounded-full border border-emerald-500/25 bg-emerald-500/10" />
          <Radar size={28} className="relative text-emerald-500" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.24em]"
            style={{ color: 'var(--po-radar-gold)' }}
          >
            <Sparkles size={11} /> {dict.radarEyebrow}
          </p>

          {loading ? (
            <p className="mt-2 text-sm font-semibold text-[var(--po-muted)]">{dict.radarScanning}</p>
          ) : (
            <>
              <h3 className="mt-2 text-xl font-black leading-tight tracking-tight text-emerald-600 md:text-2xl dark:text-emerald-400">
                {matchCount > 0 ? dict.radarTitle(matchCount) : dict.radarNoMatchTitle}
              </h3>
              {matchCount > 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--po-muted)]">
                  {dict.radarSubtitle(preview.city)}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-[var(--po-muted)]">{dict.radarAfterPublish}</p>
              )}
            </>
          )}
        </div>
      </div>

      {!loading ? (
        <div className="mt-4">
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold"
            style={{
              borderColor: 'rgba(184, 146, 46, 0.25)',
              backgroundColor: 'var(--po-radar-gold-bg)',
              color: 'var(--po-radar-gold-text)',
            }}
          >
            <Radar size={14} className="shrink-0" />
            {dict.radarEcosystem(ecosystem)}
          </div>
          {matchCount > 0 && highIntent > 0 ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Users size={14} className="shrink-0" />
              {dict.radarHighIntent(highIntent)}
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
