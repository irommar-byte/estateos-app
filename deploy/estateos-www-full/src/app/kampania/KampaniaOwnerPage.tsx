'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Circle, Copy, ExternalLink } from 'lucide-react';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';
import { CAMPAIGN_LINK_PRESETS } from '@/lib/campaignLinks';
import { useLocale } from '@/contexts/LocaleContext';
import { getKampaniaOwnerDictionary } from '@/i18n/kampaniaOwnerDictionary';
import { getKampaniaDoneBySystem, getKampaniaOwnerSteps } from '@/i18n/kampaniaOwnerContent';

const STORAGE_KEY = 'estateos_owner_checklist_v1';

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-2 text-xs font-bold text-[var(--eos-text)] hover:bg-[var(--eos-bg-elevated)]"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function KampaniaOwnerPage() {
  const { locale } = useLocale();
  const kd = getKampaniaOwnerDictionary(locale);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const ownerSteps = getKampaniaOwnerSteps(locale);
  const doneBySystem = getKampaniaDoneBySystem(locale);
  const completed = ownerSteps.filter((s) => done[s.id]).length;
  const totalMinutes = ownerSteps.reduce((a, s) => a + s.minutes, 0);
  const remainingMinutes = ownerSteps.filter((s) => !done[s.id]).reduce((a, s) => a + s.minutes, 0);

  return (
    <main className="theme-aware-dashboard eos-page-shell min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-[calc(5rem+env(safe-area-inset-top))] text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">{kd.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{kd.mainTitle}</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)]">
          <strong>{kd.introSteps}</strong> — <strong>{totalMinutes} {kd.introMinutes}</strong>.
          {kd.introRemaining} <strong>{remainingMinutes} {kd.introMinutes}</strong> ({completed}/{ownerSteps.length} {kd.introCompleted}).
        </p>

        <section className="mt-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-5">
          <h2 className="text-base font-semibold">{kd.bookmarksTitle}</h2>
          <p className="mt-2 text-sm text-[var(--eos-muted)]">
            <strong>Zakładka</strong> to zapisany adres strony u góry przeglądarki (Safari / Chrome), żeby nie szukać
            linku za każdym razem. {kd.bookmarksIntro}
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--eos-text)]">
            <li>
              <strong>{kd.bookmark1}</strong>{' '}
              <a href="/kampania" className="text-emerald-600 underline dark:text-emerald-400">
                estateos.pl/kampania
              </a>
            </li>
            <li>
              <strong>{kd.bookmark2}</strong>{' '}
              <a href="/dla-prasy" className="text-emerald-600 underline dark:text-emerald-400">
                estateos.pl/dla-prasy
              </a>
            </li>
            <li>
              <strong>{kd.bookmark3}</strong>{' '}
              <a href="/start" className="text-emerald-600 underline dark:text-emerald-400">
                estateos.pl/start
              </a>
            </li>
          </ol>
          <p className="mt-4 text-sm font-semibold text-[var(--eos-text)]">{kd.safariMac}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--eos-muted)]">
            <li>Otwórz adres (np. estateos.pl/kampania).</li>
            <li>Menu <strong>Zakładki</strong> → <strong>Dodaj zakładkę…</strong> (lub ⌘ + D).</li>
            <li>W polu „dodaj do” wybierz folder — możesz najpierw utworzyć folder „EstateOS”.</li>
            <li>Powtórz dla pozostałych dwóch adresów.</li>
          </ol>
          <p className="mt-3 text-sm font-semibold text-[var(--eos-text)]">{kd.safariIos}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--eos-muted)]">
            <li>Otwórz stronę → ikona <strong>Udostępnij</strong> (kwadrat ze strzałką).</li>
            <li><strong>Dodaj zakładkę</strong> → zapisz (opcjonalnie folder „Ulubione” lub nowy).</li>
          </ol>
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {kd.doneSectionTitle}
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--eos-muted)]">
            {doneBySystem.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 space-y-6">
          {ownerSteps.map((step, index) => {
            const isDone = !!done[step.id];
            return (
              <article
                key={step.id}
                className={`rounded-2xl border p-5 transition ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80'
                    : 'border-[var(--eos-border)] bg-[var(--eos-bg-elevated)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    className="mt-0.5 shrink-0 text-emerald-500"
                    aria-label={isDone ? kd.markUndone : kd.markDone}
                  >
                    {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-[var(--eos-muted)]" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      {step.day} · ~{step.minutes} {kd.introMinutes} · {kd.stepMeta} {index + 1}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
                    <p className="mt-2 text-sm text-[var(--eos-muted)]">{step.why}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {step.actions.map((action) =>
                        action.copy ? (
                          <CopyButton key={action.label} label={action.label} text={action.copy} copiedLabel={kd.copyDone} />
                        ) : action.href ? (
                          <a
                            key={action.label}
                            href={action.href}
                            target={action.href.startsWith('http') ? '_blank' : undefined}
                            rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400"
                          >
                            {action.label}
                            <ExternalLink size={12} />
                          </a>
                        ) : null,
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-12 rounded-2xl border border-[var(--eos-border)] p-6">
          <h2 className="text-lg font-semibold">{kd.week2Title}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--eos-muted)]">{kd.week2Items.map((item) => (<li key={item}>{item}</li>))}</ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dla-prasy" className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              {kd.pressKitLink}
            </Link>
            <Link href="/start" className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              {kd.startLink}
            </Link>
          </div>
          <div className="mt-6">
            <AppStoreBadgeLink />
          </div>
        </section>
      </div>
    </main>
  );
}
