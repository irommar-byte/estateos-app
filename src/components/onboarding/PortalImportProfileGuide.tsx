'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Crown,
  Radar,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { eosBtn } from '@/components/ui/eosButtonStyles';
import {
  getPortalImportProfileGuideDict,
  type WelcomeGuideMode,
} from '@/i18n/portalImportProfileGuideDictionary';
import {
  ESTATEOS_APP_STORE_URL,
  ESTATEOS_PLAY_STORE_URL,
  detectMobileAppContext,
} from '@/lib/estateosAppLinks';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';

type StepId = 'welcome' | 'pending' | 'ecosystem' | 'investor' | 'search' | 'radar' | 'app';

function resolveGuideMode(welcome: string | null): WelcomeGuideMode | null {
  if (welcome === 'import' || welcome === 'new') return welcome;
  return null;
}

function buildSteps(mode: WelcomeGuideMode, wantsRadar: boolean | null, offerId: number): StepId[] {
  const steps: StepId[] = [];
  if (mode === 'import' && offerId > 0) steps.push('pending');
  if (mode === 'new') steps.push('welcome');
  steps.push('ecosystem', 'investor', 'search');
  if (wantsRadar === true) steps.push('radar');
  steps.push('app');
  return steps;
}

export default function PortalImportProfileGuide({
  profileUserId,
}: {
  profileUserId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const dict = getPortalImportProfileGuideDict(locale);
  const welcome = searchParams.get('welcome');
  const guideMode = resolveGuideMode(welcome);
  const offerId = Number(searchParams.get('offer') || 0);

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [wantsRadar, setWantsRadar] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const mobile = detectMobileAppContext();

  useEffect(() => {
    if (!guideMode) return;
    void fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const uid = Number(data?.id ?? data?.user?.id);
        if (res.ok && uid === profileUserId) {
          setIsOwner(true);
          setOpen(true);
        }
      })
      .catch(() => null);
  }, [guideMode, profileUserId]);

  const steps = useMemo(
    () => (guideMode ? buildSteps(guideMode, wantsRadar, offerId) : []),
    [guideMode, wantsRadar, offerId],
  );

  const step = steps[stepIndex] ?? 'ecosystem';
  const total = steps.length;
  const onCrm = pathname?.startsWith('/moje-konto') ?? false;

  const close = useCallback(() => {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('welcome');
    url.searchParams.delete('offer');
    router.replace(url.pathname + (url.search || ''), { scroll: false });
  }, [router]);

  const goNext = () => {
    if (stepIndex >= total - 1) {
      close();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, total - 1));
  };

  if (!open || !isOwner || !guideMode || total === 0) return null;

  const panelTipsBase = guideMode === 'import' ? dict.panelTipsImport : dict.panelTipsNew;
  const panelTips = panelTipsBase.map((tip, i) =>
    guideMode === 'import' && i === 3 && offerId > 0
      ? { ...tip, href: `/edytuj-oferte/${offerId}` }
      : tip,
  );

  const isMobileApp = mobile.isIOS || mobile.isAndroid;
  const investorBadge = isMobileApp ? dict.investorBadgeApp : dict.investorBadgeWeb;
  const investorBody = isMobileApp ? dict.investorBodyApp : dict.investorBodyWeb;
  const investorPriceNote = isMobileApp ? dict.investorPriceNoteApp : dict.investorPriceNoteWeb;
  const finishLabel = onCrm ? dict.finishCrm : dict.finish;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
        role="dialog"
        aria-modal
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          className="eos-portal-guide-modal relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] bg-white text-[#141416] shadow-2xl sm:rounded-[1.75rem]"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 rounded-full border border-black/10 bg-white/90 p-2 text-[#5c5c66] hover:bg-[#f4f3f0]"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-14">
            <p className="mb-5 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
              EstateOS™ · {dict.stepOf(stepIndex + 1, total)}
            </p>

            {step === 'welcome' ? (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                  <Sparkles size={12} /> {dict.welcomeBadge}
                </span>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-[#141416]">{dict.welcomeTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">{dict.welcomeBody}</p>
                <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                  {dict.welcomeCouponHint}
                </p>
              </div>
            ) : null}

            {step === 'pending' ? (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  <Clock size={12} /> {dict.pendingBadge}
                </span>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-[#141416]">{dict.pendingTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">
                  {offerId > 0 ? dict.pendingBody(offerId) : dict.pendingBody(0).replace('#0', '')}
                </p>
                <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {dict.pendingHint}
                </p>
              </div>
            ) : null}

            {step === 'ecosystem' ? (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--eos-contrast)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-text)] dark:bg-white dark:text-[var(--eos-contrast)]">
                  <BadgeCheck size={12} /> {dict.ecosystemBadge}
                </span>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-[#141416]">{dict.ecosystemTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">{dict.ecosystemBody}</p>
                <ul className="mt-5 space-y-3">
                  {dict.ecosystemBullets.map((line) => (
                    <li key={line} className="flex gap-3 text-sm leading-relaxed text-[#5c5c66]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {step === 'investor' ? (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white">
                  <Crown size={14} /> {investorBadge}
                </span>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-[#141416]">{dict.investorTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">{investorBody}</p>
                <p className="mt-3 text-sm font-semibold text-[#141416]">{dict.investorCredits}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#5c5c66]">{investorPriceNote}</p>
                <div className="mt-8 flex flex-col gap-3">
                  {isMobileApp ? (
                    <a
                      href={mobile.isIOS ? ESTATEOS_APP_STORE_URL : ESTATEOS_PLAY_STORE_URL}
                      className="eos-guide-btn-primary flex items-center justify-center gap-2 rounded-2xl bg-[#F59E0B] py-4 text-sm font-black uppercase tracking-widest text-white"
                    >
                      <Smartphone size={18} /> {dict.investorCta}
                    </a>
                  ) : (
                    <Link
                      href="/cennik"
                      className="eos-guide-btn-primary flex items-center justify-center gap-2 rounded-2xl bg-[#F59E0B] py-4 text-sm font-black uppercase tracking-widest text-white"
                    >
                      <Crown size={18} /> {dict.investorCtaWeb}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={goNext}
                    className="eos-guide-btn-ghost py-2 text-center text-sm font-semibold"
                  >
                    {dict.investorLater}
                  </button>
                </div>
                {!isMobileApp ? (
                  <div className="eos-guide-app-footer mt-8 border-t border-black/[0.08] pt-6">
                    <div className="flex flex-col items-center gap-3">
                      <AppStoreBadgeLink className="h-10" />
                      <p className="max-w-xs text-center text-xs leading-relaxed text-[#5c5c66]">
                        {dict.investorAppTrialHint}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 'search' ? (
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#141416]">{dict.searchTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">{dict.searchBody}</p>
                <div className="mt-8 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWantsRadar(true);
                      setStepIndex((i) => i + 1);
                    }}
                    className="eos-guide-btn-primary flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-widest text-black"
                  >
                    <Radar size={18} /> {dict.searchYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWantsRadar(false);
                      setStepIndex((i) => i + 1);
                    }}
                    className="eos-guide-btn-secondary rounded-2xl border border-black/12 bg-[#f7f7f5] py-4 text-sm font-semibold"
                  >
                    {dict.searchNo}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 'radar' ? (
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[#141416]">
                  <Radar className="text-emerald-600" size={24} /> {dict.radarTitle}
                </h2>
                <ol className="mt-5 space-y-4">
                  {dict.radarSteps.map((line, i) => (
                    <li key={line} className="flex gap-3 text-sm leading-relaxed text-[#5c5c66]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-black text-emerald-700">
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
                <Link
                  href="/moje-konto/crm?tab=radar"
                  className="eos-btn eos-btn--home eos-btn--block mt-6"
                >
                  {dict.radarCta} <ArrowRight size={16} />
                </Link>
              </div>
            ) : null}

            {step === 'app' ? (
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#141416]">{dict.appTitle}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">{dict.appBody}</p>
                <div className="eos-guide-app-footer mt-8 border-t border-black/[0.08] pt-6">
                  <AppStoreBadgeLink />
                </div>

                <h3 className="mt-8 text-sm font-black uppercase tracking-widest text-[#141416]">
                  {dict.panelTitle}
                </h3>
                <ul className="mt-4 space-y-2">
                  {panelTips.map((tip) => (
                    <li key={tip.label}>
                      <Link
                        href={tip.href}
                        className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-[#fafaf8] px-4 py-3 transition hover:border-emerald-500/30"
                      >
                        <Sparkles size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-sm font-bold text-[#141416]">{tip.label}</p>
                          <p className="text-xs text-[#8a8a94]">{tip.hint}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {step !== 'search' && step !== 'investor' ? (
            <div className="border-t border-black/[0.06] p-4">
              <button
                type="button"
                onClick={goNext}
                className={eosBtn('primary', { block: true, className: '!rounded-2xl !py-4 !text-sm !tracking-widest' })}
              >
                {stepIndex >= total - 1 ? (
                  <>
                    <Check size={18} /> {finishLabel}
                  </>
                ) : (
                  <>
                    {dict.next} <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
