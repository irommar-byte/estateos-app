"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Loader2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

type OfferBrief = {
  id: number;
  title: string;
  city: string | null;
  imageUrl: string | null;
};

type ProfilePayload = {
  likesCount: number;
  dislikesCount: number;
  fastTrackCount: number;
  opensCount: number;
  topCities: Array<{ key: string; value: number }>;
  topDistricts: Array<{ key: string; value: number }>;
  topPropertyTypes: Array<{ key: string; value: number }>;
  preferredBudgetPln: number | null;
  preferredAreaM2: number | null;
  preferredTransaction: "SELL" | "RENT" | "MIXED" | null;
  summaryLine: string;
  confidence: number;
  contradictionIndex: number;
  explorationHunger: number;
  searchPhase: string;
  hasProfile: boolean;
  updatedAt: string | null;
};

type Trope = {
  offerId: number;
  status: string;
  priority: boolean;
  updatedAt: string;
  offer: OfferBrief | null;
};

type RecentEvent = {
  id: string;
  eventType: string;
  reasonCode: string | null;
  at: string;
  offer: OfferBrief | null;
};

type Guide = {
  nextStep?: { title?: string; action?: string; offerId?: number | null };
  confidence?: number;
};

function eventLabel(type: string): { label: string; Icon: typeof ThumbsUp; tone: string } {
  switch (type) {
    case "DISCOVERY_LIKE":
      return { label: "Pasuje", Icon: ThumbsUp, tone: "text-emerald-400" };
    case "DISCOVERY_DISLIKE":
      return { label: "Nie dla mnie", Icon: ThumbsDown, tone: "text-rose-300" };
    case "DISCOVERY_PRIORITY":
      return { label: "Na poważnie", Icon: Sparkles, tone: "text-amber-300" };
    case "DISCOVERY_DEPTH_OPEN":
      return { label: "Otwarto", Icon: Compass, tone: "text-sky-300" };
    default:
      return { label: type.replace("DISCOVERY_", ""), Icon: Compass, tone: "text-white/60" };
  }
}

function formatMoney(n: number | null) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${Math.round(n).toLocaleString("pl-PL")} PLN`;
}

function confidenceLabel(c: number) {
  if (c < 0.12) return "Cold start";
  if (c < 0.35) return "Zarys";
  if (c < 0.6) return "Wyraźny kierunek";
  return "Silny sygnał";
}

export default function MojKierunekClient() {
  const [auth, setAuth] = useState<"loading" | "guest" | "user">("loading");
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [tropes, setTropes] = useState<Trope[]>([]);
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [pulse, setPulse] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const res = await fetch("/api/discovery/profile", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuth("guest");
        setProfile(null);
        return;
      }
      if (!res.ok) {
        setError("Nie udało się wczytać kierunku.");
        return;
      }
      const data = await res.json();
      setAuth("user");
      setProfile(data.profile || null);
      setTropes(Array.isArray(data.tropes) ? data.tropes : []);
      setRecent(Array.isArray(data.recent) ? data.recent : []);
      setGuide(data.guide || null);
      setError(null);
      setPulse((n) => n + 1);
    } catch {
      setError("Brak połączenia. Spróbuj ponownie.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load({ silent: true })), [load]);

  // Soft poll while visible — reliable live mirror during scoring in another tab.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    const id = window.setInterval(tick, 6000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

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
      <main className="relative min-h-screen overflow-hidden bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.12),_transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-6 py-20">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-400/90">EstateOS™</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Mój kierunek</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--eos-muted)]">
            Zaloguj się, aby zobaczyć, jak każda cicha decyzja na ofertach buduje Twój gust — na żywo.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent("/moj-kierunek")}`}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
          >
            Zaloguj się
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  const confPct = Math.round(Math.min(1, Math.max(0, profile?.confidence ?? 0)) * 100);
  const guideTitle = guide?.nextStep?.title || "Zacznij oceniać oferty — kierunek pojawi się tutaj.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--eos-bg)] pb-24 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(251,191,36,0.14),_transparent_50%),radial-gradient(ellipse_at_90%_10%,_rgba(16,185,129,0.08),_transparent_45%)]" />

      <div className="relative mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <header className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-amber-200">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-400/90">EstateOS™</p>
              <p className="text-xs text-[var(--eos-muted)]">Discovery · żywy podgląd</p>
            </div>
            {refreshing ? <Loader2 className="ml-auto size-4 animate-spin text-amber-300/80" /> : null}
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">Mój kierunek</h1>
          <p className="mt-3 text-base leading-7 text-[var(--eos-muted)]">
            Otwórz tę stronę obok katalogu. Każde <span className="text-[var(--eos-text)]">Pasuje</span>,{" "}
            <span className="text-[var(--eos-text)]">Nie dla mnie</span> i{" "}
            <span className="text-[var(--eos-text)]">Na poważnie</span> odświeża ten widok natychmiast.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/oferty"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-100"
            >
              Oceń oferty
              <ArrowRight size={15} />
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/80 px-5 py-2.5 text-sm font-semibold text-[var(--eos-text)] backdrop-blur"
            >
              Odśwież
            </button>
          </div>
        </header>

        {error ? (
          <p className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.section
            key={pulse}
            initial={{ opacity: 0.55, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-10 space-y-8"
          >
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/45 p-6 backdrop-blur-2xl sm:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Guide mówi</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {guideTitle}
              </h2>
              <p className="mt-3 text-sm text-white/55">
                {profile?.summaryLine || "Za mało decyzji — ocen kilka ofert, a tu pojawi się zarys gustu."}
              </p>

              <div className="mt-7">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <span className="text-xs font-semibold text-white/70">
                    Pewność · {confidenceLabel(profile?.confidence ?? 0)}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-amber-200">{confPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${confPct}%` }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Pasuje", value: profile?.likesCount ?? 0 },
                  { label: "Nie dla mnie", value: profile?.dislikesCount ?? 0 },
                  { label: "Na poważnie", value: profile?.fastTrackCount ?? 0 },
                  { label: "Otwarcia", value: profile?.opensCount ?? 0 },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <section>
              <h3 className="text-lg font-semibold tracking-tight">Co EstateOS już wie</h3>
              <p className="mt-1 text-sm text-[var(--eos-muted)]">
                {decisions === 0
                  ? "Jeszcze pusto — to cold start. Pierwsze decyzje tu zaskoczą."
                  : "Sygnały z Twoich ocen. Aktualizują się po każdej opcji."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InsightBlock title="Miasta" items={profile?.topCities || []} empty="—" />
                <InsightBlock title="Dzielnice" items={profile?.topDistricts || []} empty="—" />
                <InsightBlock title="Typ" items={profile?.topPropertyTypes || []} empty="—" />
              </div>
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

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Ostatnie decyzje</h3>
                  <p className="mt-1 text-sm text-[var(--eos-muted)]">
                    Najnowsze na górze — tu widać każdą dodaną opcję.
                  </p>
                </div>
                <span className="text-xs tabular-nums text-[var(--eos-muted)]">#{pulse}</span>
              </div>
              {recent.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--eos-border)] px-5 py-10 text-center text-sm text-[var(--eos-muted)]">
                  Brak decyzji. Idź do{" "}
                  <Link href="/oferty" className="font-semibold text-amber-400 underline-offset-2 hover:underline">
                    /oferty
                  </Link>
                  , najedź na kartę i wybierz jedną z trzech opcji.
                </div>
              ) : (
                <ul className="space-y-2">
                  {recent.map((ev) => {
                    const meta = eventLabel(ev.eventType);
                    const Icon = meta.Icon;
                    return (
                      <li key={ev.id}>
                        <Link
                          href={ev.offer ? `/oferta/${ev.offer.id}` : "/oferty"}
                          className="group flex items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-3 transition hover:border-amber-400/35"
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
                            </p>
                            <p className="truncate text-sm font-semibold text-[var(--eos-text)]">
                              {ev.offer?.title || "Oferta"}
                            </p>
                            <p className="text-xs text-[var(--eos-muted)]">
                              {[ev.offer?.city, new Date(ev.at).toLocaleString("pl-PL")].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <ArrowRight
                            size={16}
                            className="shrink-0 text-[var(--eos-muted)] transition group-hover:translate-x-0.5 group-hover:text-amber-300"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {tropes.length > 0 ? (
              <section>
                <h3 className="text-lg font-semibold tracking-tight">Tropy na poważnie</h3>
                <p className="mt-1 text-sm text-[var(--eos-muted)]">Oferty oznaczone jako ważne w Twojej ścieżce.</p>
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
                          {t.priority || t.status === "SERIOUS" ? "Na poważnie" : t.status}
                        </p>
                        <p className="truncate text-sm font-semibold">{t.offer?.title || `Oferta #${t.offerId}`}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}

function InsightBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ key: string; value: number }>;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--eos-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.slice(0, 4).map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{item.key}</span>
              <span className="tabular-nums text-[var(--eos-muted)]">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
