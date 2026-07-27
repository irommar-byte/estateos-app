"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useDiscoveryProfile } from "@/hooks/useDiscoveryProfile";
import {
  discoveryDisplayLabel,
  discoveryEventLabel,
  discoveryReasonLabel,
} from "@/lib/discovery/displayLabels";

const spring = { type: "spring" as const, stiffness: 280, damping: 28 };

function eventLabel(type: string): { label: string; Icon: typeof ThumbsUp; tone: string } {
  switch (type) {
    case "DISCOVERY_LIKE":
      return { label: discoveryEventLabel(type) || "Pasuje", Icon: ThumbsUp, tone: "text-emerald-400" };
    case "DISCOVERY_DISLIKE":
      return { label: discoveryEventLabel(type) || "Nie dla mnie", Icon: ThumbsDown, tone: "text-rose-300" };
    case "DISCOVERY_PRIORITY":
      return { label: discoveryEventLabel(type) || "Na poważnie", Icon: Sparkles, tone: "text-amber-300" };
    case "DISCOVERY_DEPTH_OPEN":
      return { label: discoveryEventLabel(type) || "Otwarto", Icon: Compass, tone: "text-sky-300" };
    default:
      return {
        label: discoveryDisplayLabel(type.replace(/^DISCOVERY_/, "")),
        Icon: Compass,
        tone: "text-white/60",
      };
  }
}

function formatMoney(n: number | null) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${Math.round(n).toLocaleString("pl-PL")} PLN`;
}

/** Deep preference mirror — analytics only, Apple Intelligence calm. */
export default function LustroClient() {
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);

  const onNewDecision = useCallback((eventType: string) => {
    const meta = eventLabel(eventType);
    setToast(`Zapisano: ${meta.label}`);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const { auth, profile, tropes, recent, refreshing, error, reload } = useDiscoveryProfile({
    onNewDecision,
  });

  const decisions = useMemo(() => {
    if (!profile) return 0;
    return profile.likesCount + profile.dislikesCount + profile.fastTrackCount;
  }, [profile]);

  if (auth === "loading") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <Loader2 className="size-6 animate-spin text-amber-400" />
      </main>
    );
  }

  if (auth === "guest") {
    return (
      <main className="relative min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <div
          className="relative mx-auto max-w-2xl px-6 pb-20"
          style={{ paddingTop: "calc(var(--eos-nav-height) + 3rem)" }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-400/90">EstateOS™</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Lustro preferencji</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--eos-muted)]">
            Zaloguj się, aby zobaczyć głęboką analizę gustu zbudowaną z Twoich cichych decyzji.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent("/lustro")}`}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-[13px] font-semibold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
          >
            Zaloguj się
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[var(--eos-bg)] pb-20 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(251,191,36,0.1),_transparent_48%),radial-gradient(ellipse_at_90%_10%,_rgba(16,185,129,0.06),_transparent_40%)]" />

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
            className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 backdrop-blur-xl"
            style={{ top: "calc(var(--eos-nav-height) + 0.75rem)" }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="relative mx-auto max-w-5xl px-4 sm:px-6"
        style={{ paddingTop: "calc(var(--eos-nav-height) + 2rem)" }}
      >
        <motion.header
          className="flex flex-wrap items-start justify-between gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <div className="min-w-0 max-w-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-400/90">
              EstateOS™ Inteligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Lustro preferencji</h1>
            <p className="mt-2 text-[15px] leading-6 text-[var(--eos-muted)]">
              {profile?.summaryLine && !profile.summaryLine.includes("Za mało")
                ? profile.summaryLine
                : "Głęboka analiza gustu — aktualizuje się po każdej decyzji."}
            </p>
            <Link
              href="/moj-kierunek"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
            >
              ← Wróć do kierunku
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/oferty"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5 hover:bg-emerald-400 active:scale-[0.98]"
            >
              Oceń oferty
              <ArrowRight size={15} />
            </Link>
            <button
              type="button"
              aria-label="Odśwież"
              disabled={refreshing}
              onClick={() => void reload({ force: true })}
              className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)] transition hover:border-emerald-400/35 hover:text-emerald-300 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </motion.header>

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <motion.section
          className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
        >
          {[
            { label: "Pasuje", value: profile?.likesCount ?? 0 },
            { label: "Nie dla mnie", value: profile?.dislikesCount ?? 0 },
            { label: "Na poważnie", value: profile?.fastTrackCount ?? 0 },
            { label: "Otwarcia", value: profile?.opensCount ?? 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="min-h-[4.75rem] rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]/90 px-3 py-3 backdrop-blur"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                {stat.label}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none">{stat.value}</p>
            </div>
          ))}
        </motion.section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Co EstateOS już wie</h2>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">
            {decisions === 0 ? "Start — pierwsze decyzje tu zaskoczą." : "Sygnały z Twoich ocen."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InsightBlock title="Miasta" items={profile?.topCities || []} />
            <InsightBlock title="Dzielnice" items={profile?.topDistricts || []} />
            <InsightBlock title="Typ" items={profile?.topPropertyTypes || []} />
          </div>
          {(profile?.dislikeReasons?.length || 0) > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                Powody „nie dla mnie”
              </p>
              <div className="flex flex-wrap gap-2">
                {profile!.dislikeReasons.map((r) => (
                  <span
                    key={r.key}
                    className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-100"
                  >
                    {discoveryReasonLabel(r.key) || discoveryDisplayLabel(r.key)} · {r.value}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--eos-muted)]">
            {formatMoney(profile?.preferredBudgetPln ?? null) ? (
              <span className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1.5">
                Budżet ~{formatMoney(profile?.preferredBudgetPln ?? null)}
              </span>
            ) : null}
            {profile?.preferredAreaM2 ? (
              <span className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1.5">
                ~{profile.preferredAreaM2} m²
              </span>
            ) : null}
            {profile?.preferredTransaction ? (
              <span className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1.5">
                {profile.preferredTransaction === "SELL"
                  ? "Sprzedaż"
                  : profile.preferredTransaction === "RENT"
                    ? "Wynajem"
                    : "Mieszane"}
              </span>
            ) : null}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Ostatnie decyzje</h2>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">Najnowsze na górze.</p>
          {recent.length === 0 ? (
            <div className="mt-4 rounded-[1.5rem] border border-dashed border-[var(--eos-border)] px-5 py-8 text-center text-sm text-[var(--eos-muted)]">
              Brak decyzji. Oceń oferty w{" "}
              <Link href="/oferty" className="font-semibold text-emerald-400 hover:underline">
                katalogu
              </Link>
              .
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {recent.map((ev) => {
                const meta = eventLabel(ev.eventType);
                const Icon = meta.Icon;
                const reason = ev.reasonCode
                  ? discoveryReasonLabel(ev.reasonCode) || discoveryDisplayLabel(ev.reasonCode)
                  : null;
                return (
                  <li key={ev.id}>
                    <Link
                      href={ev.offer ? `/oferta/${ev.offer.id}` : "/oferty"}
                      className="group flex items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-3 transition hover:border-emerald-400/30"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                        {ev.offer?.imageUrl ? (
                          <Image
                            src={ev.offer.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-white/30">
                            <Icon size={18} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${meta.tone}`}>
                          {meta.label}
                          {reason ? ` · ${reason}` : ""}
                        </p>
                        <p className="truncate text-sm font-semibold">{ev.offer?.title || "Oferta"}</p>
                        <p className="text-xs text-[var(--eos-muted)]">
                          {[ev.offer?.city, new Date(ev.at).toLocaleString("pl-PL")].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-[var(--eos-muted)] transition group-hover:translate-x-0.5 group-hover:text-emerald-300"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {tropes.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">Tropy na poważnie</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tropes.map((t) => (
                <Link
                  key={`${t.offerId}-${t.updatedAt}`}
                  href={`/oferta/${t.offerId}`}
                  className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3 transition hover:bg-amber-400/10"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                    {t.offer?.imageUrl ? (
                      <Image
                        src={t.offer.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                      {t.priority || t.status === "SERIOUS"
                        ? "Na poważnie"
                        : discoveryDisplayLabel(t.status)}
                    </p>
                    <p className="truncate text-sm font-semibold">{t.offer?.title || `Oferta #${t.offerId}`}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function InsightBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; value: number }>;
}) {
  return (
    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--eos-muted)]">—</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.slice(0, 4).map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{discoveryDisplayLabel(item.key)}</span>
              <span className="tabular-nums text-[var(--eos-muted)]">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
