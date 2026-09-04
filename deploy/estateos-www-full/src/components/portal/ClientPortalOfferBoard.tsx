"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  HelpCircle,
  Inbox,
  LayoutList,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import ClientPortalMatchCard from "@/components/portal/ClientPortalMatchCard";
import ClientPortalOfferSearchPanel from "@/components/portal/ClientPortalOfferSearchPanel";
import ClientPortalUpcomingOfferSlot from "@/components/portal/ClientPortalUpcomingOfferSlot";
import {
  hasUnreadAgentReply,
  parseClientOfferFeedback,
  type ClientOfferSentiment,
} from "@/lib/crm/clientPortalFeedback";
import {
  OFFER_STACKS,
  buildPortalTimeline,
  buildSearchDirection,
  computePortalOfferStats,
  defaultOpenStacks,
  formatPortalWhen,
  groupPortalOfferStacks,
  resolveAssistantPulse,
  stackIdFromSentiment,
  type OfferStackId,
  type PortalBoardActivity,
  type PortalSearchCriteria,
  type PortalTimelineItem,
} from "@/lib/crm/clientPortalOfferBoard";

type PortalMatch = {
  id: number;
  score: number;
  notifiedAt: string | null;
  clientFeedback: string | null;
  clientFeedbackAt: string | null;
  intelligenceSent?: boolean;
  intelligenceReason?: string | null;
  clientWhy?: string | null;
  offer: {
    id: number;
    title: string;
    price: number;
    priceCurrency: string | null;
    city: string;
    district: string | null;
    street?: string | null;
    area: number;
    rooms?: number | null;
    excerpt?: string | null;
    description?: string | null;
    imageUrl: string;
    imageUrls?: string[] | null;
  };
};

type ViewMode = "stacks" | "timeline";

const STACK_ICON: Record<OfferStackId, typeof Inbox> = {
  new: Inbox,
  like: ThumbsUp,
  maybe: HelpCircle,
  dislike: ThumbsDown,
};

function storageKey(token: string, name: string) {
  return `eos-portal-${name}:${token}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: "new" | "ok" | "warn" | "danger" | "muted";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-rose-700"
          : tone === "new"
            ? "text-sky-700"
            : "text-[var(--eos-text)]";
  return (
    <div className="eos-inset-well rounded-2xl px-3.5 py-3">
      <p className="eos-portal-label">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-[var(--eos-muted)]">{hint}</p> : null}
    </div>
  );
}

function DistributionBar({
  sent,
  like,
  maybe,
  dislike,
  pending,
}: {
  sent: number;
  like: number;
  maybe: number;
  dislike: number;
  pending: number;
}) {
  if (!sent) return null;
  const parts = [
    { key: "like", n: like, className: "bg-emerald-500" },
    { key: "maybe", n: maybe, className: "bg-amber-400" },
    { key: "dislike", n: dislike, className: "bg-rose-400" },
    { key: "pending", n: pending, className: "bg-sky-400" },
  ];
  return (
    <div className="mt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
        {parts.map((part) =>
          part.n ? (
            <span
              key={part.key}
              className={part.className}
              style={{ width: `${(part.n / sent) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-[var(--eos-muted)]">
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-emerald-500" /> Chcę oglądać</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-amber-400" /> Do przemyślenia</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-rose-400" /> Nie pasuje</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-sky-400" /> Do oceny</span>
      </div>
    </div>
  );
}

function TimelineDot({ tone }: { tone: PortalTimelineItem["tone"] }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "danger"
          ? "bg-rose-500"
          : tone === "new"
            ? "bg-sky-500"
            : "bg-slate-400";
  return <span className={`absolute left-[-5px] top-1.5 size-2.5 rounded-full ring-4 ring-[var(--eos-bg)] ${cls}`} />;
}

export default function ClientPortalOfferBoard({
  token,
  matches,
  activities,
  criteria,
  intelligenceEnabled,
  live,
  unscoredCount,
  pendingCheckback,
  awaitingFirstOffer,
  freshBanner,
  savingId,
  openMatchIds,
  onToggleMatch,
  onEnsureMatchOpen,
  onSubmit,
  onAckReply,
  prefillFor,
}: {
  token: string;
  matches: PortalMatch[];
  activities: PortalBoardActivity[];
  criteria: PortalSearchCriteria;
  intelligenceEnabled: boolean;
  live: boolean;
  unscoredCount: number;
  pendingCheckback: boolean;
  awaitingFirstOffer: boolean;
  freshBanner: string | null;
  savingId: number | null;
  openMatchIds: number[];
  onToggleMatch: (matchId: number) => void;
  onEnsureMatchOpen: (matchId: number) => void;
  onSubmit: (
    matchId: number,
    payload: {
      sentiment: ClientOfferSentiment | null;
      liked: string;
      disliked: string;
      phrases: string[];
      note: string;
    },
  ) => Promise<void>;
  onAckReply?: (matchId: number) => Promise<void>;
  prefillFor?: {
    matchId?: number;
    offerId?: number;
    sentiment?: ClientOfferSentiment | null;
    phrase?: string | null;
  };
}) {
  const stats = useMemo(() => computePortalOfferStats(matches), [matches]);
  const stacks = useMemo(() => groupPortalOfferStacks(matches), [matches]);
  const direction = useMemo(() => buildSearchDirection(criteria, matches), [criteria, matches]);
  const timeline = useMemo(() => buildPortalTimeline(matches, activities), [matches, activities]);
  const pulse = useMemo(
    () =>
      resolveAssistantPulse({
        intelligenceEnabled,
        pendingNewCount: stats.pending,
        unscoredCount,
        pendingCheckback,
      }),
    [intelligenceEnabled, stats.pending, unscoredCount, pendingCheckback],
  );
  const pulseBeforeStacks = Boolean(pulse && pulse.mode !== "waiting_reaction");
  const pulseAfterStacks = pulse?.mode === "waiting_reaction";
  const maxPhrase = Math.max(1, ...direction.phraseBars.map((bar) => bar.count));

  const [view, setView] = useState<ViewMode>("stacks");
  const [openStacks, setOpenStacks] = useState<OfferStackId[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!token) return;
    const storedView = readJson<ViewMode>(storageKey(token, "view"), "stacks");
    setView(storedView === "timeline" ? "timeline" : "stacks");
    const storedStacks = readJson<OfferStackId[] | null>(storageKey(token, "stacks"), null);
    const unreadStacks = (Object.entries(stacks) as Array<[OfferStackId, PortalMatch[]]>)
      .filter(([, rows]) =>
        rows.some((row) => hasUnreadAgentReply(parseClientOfferFeedback(row.clientFeedback))),
      )
      .map(([id]) => id);
    setOpenStacks(
      storedStacks?.length
        ? Array.from(new Set([...storedStacks, ...unreadStacks]))
        : Array.from(new Set([...defaultOpenStacks(stats), ...unreadStacks])),
    );
    setHydrated(true);
    // First visit only — later poll must not re-collapse stacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    writeJson(storageKey(token, "view"), view);
  }, [hydrated, token, view]);

  useEffect(() => {
    if (!hydrated || !token) return;
    writeJson(storageKey(token, "stacks"), openStacks);
  }, [hydrated, token, openStacks]);

  const toggleStack = (id: OfferStackId) => {
    setOpenStacks((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const focusNewOffers = () => {
    setView("stacks");
    if (!openStacks.includes("new")) setOpenStacks((current) => [...current, "new"]);
    const first = stacks.new[0];
    if (first) onEnsureMatchOpen(first.id);
    window.setTimeout(() => {
      document.getElementById("portal-stack-new")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const pulseSlot = pulse ? (
    <ClientPortalUpcomingOfferSlot pulse={pulse} live={live} onFocusNew={focusNewOffers} />
  ) : null;

  const jumpToMatch = (matchId?: number) => {
    if (!matchId) return;
    setView("stacks");
    const stack = (Object.entries(stacks) as Array<[OfferStackId, PortalMatch[]]>).find(([, rows]) =>
      rows.some((row) => row.id === matchId),
    )?.[0];
    if (stack && !openStacks.includes(stack)) setOpenStacks((current) => [...current, stack]);
    if (!openMatchIds.includes(matchId)) onEnsureMatchOpen(matchId);
    window.setTimeout(() => {
      document.getElementById(`portal-match-${matchId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  return (
    <section id="portal-matches" className="client-portal-board space-y-4 scroll-mt-24">
      <div className="eos-inset-frame rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eos-portal-label eos-portal-label--ok">Twój przegląd</p>
            <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">Oferty od agenta</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--eos-muted)]">
              Segregujemy propozycje tak, żebyś zawsze wiedział, co jest nowe, co chcesz zobaczyć i co już odłożyłeś.
              Rozwiniętą kartę zostawiamy otwartą — nic samo się nie chowa.
            </p>
          </div>
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
              <span className="eos-live-dot shrink-0" aria-hidden />
              Live
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Wysłane" value={stats.sent} hint={stats.lastSentAt ? `Ostatnia ${formatPortalWhen(stats.lastSentAt)}` : "Czekamy na pierwszą"} tone="muted" />
          <StatTile
            label="Do oceny"
            value={stats.pending}
            hint={stats.pending ? "Tu zaczynasz" : "Wszystko ocenione"}
            tone="new"
          />
          <StatTile label="Chcę oglądać" value={stats.like} hint="Do prezentacji" tone="ok" />
          <StatTile label="Nie pasuje" value={stats.dislike} hint={stats.maybe ? `+ ${stats.maybe} do przemyślenia` : "Odłożone"} tone="danger" />
        </div>
        <DistributionBar sent={stats.sent} like={stats.like} maybe={stats.maybe} dislike={stats.dislike} pending={stats.pending} />
        {stats.sent ? (
          <p className="mt-3 text-[12px] text-[var(--eos-muted)]">
            Odpowiedziałeś na <strong className="text-[var(--eos-text)]">{stats.responsePct}%</strong> propozycji
            {stats.lastReactionAt ? ` · ostatnia reakcja ${formatPortalWhen(stats.lastReactionAt)}` : ""}.
          </p>
        ) : null}
      </div>

      <div className="eos-inset-frame rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eos-portal-label eos-portal-label--ok">{direction.headline}</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[var(--eos-text)]">{direction.summary}</p>
            {intelligenceEnabled ? (
              <p className="mt-1 text-[12px] text-[var(--eos-muted)]">
                Asystent dobiera jedną pewną ofertę na raz i uczy się z Twoich reakcji — nie z czatu.
              </p>
            ) : null}
          </div>
        </div>
        {direction.chips.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {direction.chips.map((chip) => (
              <span key={chip.key} className="eos-raised-chip rounded-full px-3 py-1.5 text-[11px]">
                <span className="text-[var(--eos-muted)]">{chip.label}: </span>
                <span className="font-semibold text-[var(--eos-text)]">{chip.value}</span>
              </span>
            ))}
          </div>
        ) : null}
        {direction.phraseBars.length ? (
          <div className="mt-5 space-y-2">
            <p className="eos-portal-label">Co powtarzasz najczęściej</p>
            {direction.phraseBars.map((bar) => (
              <div key={bar.phrase} className="flex items-center gap-3">
                <p className="w-36 shrink-0 truncate text-[12px] font-semibold text-[var(--eos-text)] sm:w-48">
                  {bar.phrase}
                </p>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                  <div
                    className={`h-full rounded-full ${bar.tone === "like" ? "bg-emerald-500" : "bg-rose-400"}`}
                    style={{ width: `${Math.max(12, (bar.count / maxPhrase) * 100)}%` }}
                  />
                </div>
                <span className="w-5 text-right text-[11px] font-black tabular-nums text-[var(--eos-muted)]">
                  {bar.count}
                </span>
              </div>
            ))}
          </div>
        ) : stats.sent ? (
          <p className="mt-4 text-[12px] leading-relaxed text-[var(--eos-muted)]">
            Zaznacz plusy i minusy przy ofertach — tutaj pojawi się, w którą stronę idziemy.
          </p>
        ) : null}
      </div>

      {freshBanner ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-[var(--eos-text)]">
          Nowa propozycja w stosie „Nowe do oceny”: {freshBanner}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] p-1">
          <button
            type="button"
            onClick={() => setView("stacks")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
              view === "stacks" ? "bg-emerald-500 text-white" : "text-[var(--eos-muted)]"
            }`}
          >
            <LayoutList className="size-3.5" />
            Stosy
          </button>
          <button
            type="button"
            onClick={() => setView("timeline")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
              view === "timeline" ? "bg-emerald-500 text-white" : "text-[var(--eos-muted)]"
            }`}
          >
            <CalendarClock className="size-3.5" />
            Oś czasu
          </button>
        </div>
        <p className="text-[11px] text-[var(--eos-muted)]">
          Kliknij wiersz oferty, żeby rozwinąć. Możesz mieć otwartych kilka naraz.
        </p>
      </div>

      {matches.length === 0 ? (
        awaitingFirstOffer ? (
          <ClientPortalOfferSearchPanel unscoredCount={unscoredCount} live={live} />
        ) : (
          <div className="eos-inset-well rounded-2xl border border-dashed border-[var(--eos-border)] p-8 text-center">
            <p className="text-sm font-semibold text-[var(--eos-text)]">Agent przygotowuje propozycje</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              Gdy agent udostępni ofertę, zobaczysz ją w stosie „Nowe do oceny”.
            </p>
          </div>
        )
      ) : view === "timeline" ? (
        <div className="space-y-3">
          {pulseSlot}
          <div className="eos-inset-frame rounded-[1.6rem] p-5 sm:p-6">
          <p className="eos-portal-label eos-portal-label--ok">Historia współpracy</p>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">
            Kiedy poszła oferta, co odpowiedziałeś i o co pytał asystent.
          </p>
          {timeline.length ? (
            <ol className="relative mt-5 ml-2 space-y-4 border-l border-[var(--eos-border)] pl-5">
              {timeline.map((item) => (
                <li key={item.id} className="relative">
                  <TimelineDot tone={item.tone} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                    {formatPortalWhen(item.at)}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--eos-text)]">{item.title}</p>
                  {item.body ? (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--eos-muted)]">{item.body}</p>
                  ) : null}
                  {item.matchId ? (
                    <button
                      type="button"
                      onClick={() => jumpToMatch(item.matchId)}
                      className="mt-1 text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      Pokaż ofertę
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-[var(--eos-muted)]">Historia pojawi się po pierwszej wysłanej ofercie.</p>
          )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pulseBeforeStacks ? pulseSlot : null}
          {OFFER_STACKS.map((stack) => {
            const rows = stacks[stack.id];
            if (!rows.length && stack.id !== "new") return null;
            const open = openStacks.includes(stack.id);
            const Icon = STACK_ICON[stack.id];
            const unreadCount = rows.filter((row) =>
              hasUnreadAgentReply(parseClientOfferFeedback(row.clientFeedback)),
            ).length;
            return (
              <div id={`portal-stack-${stack.id}`} key={stack.id} className="eos-inset-frame scroll-mt-24 overflow-hidden rounded-[1.6rem]">
                <button
                  type="button"
                  onClick={() => toggleStack(stack.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                  aria-expanded={open}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[rgba(15,23,42,0.05)] text-[var(--eos-text)]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-[var(--eos-text)]">{stack.title}</span>
                      <span className="eos-lux-badge">{rows.length}</span>
                      {unreadCount ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-800">
                          {unreadCount} do przeczytania
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--eos-muted)]">{stack.hint}</span>
                  </span>
                  <ChevronDown className={`size-4 shrink-0 text-[var(--eos-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-[rgba(196,163,90,0.14)] px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                    {rows.length ? (
                      rows.map((match) => (
                        <ClientPortalMatchCard
                          key={match.id}
                          match={match}
                          token={token}
                          saving={savingId === match.id}
                          expanded={openMatchIds.includes(match.id)}
                          onToggle={() => onToggleMatch(match.id)}
                          prefill={
                            match.id === prefillFor?.matchId || match.offer.id === prefillFor?.offerId
                              ? { sentiment: prefillFor?.sentiment ?? null, phrase: prefillFor?.phrase ?? null }
                              : undefined
                          }
                          onSubmit={async (payload) => {
                            const dest = stackIdFromSentiment(payload.sentiment);
                            await onSubmit(match.id, payload);
                            setOpenStacks((current) =>
                              current.includes(dest) ? current : [...current, dest],
                            );
                          }}
                          onAckReply={onAckReply}
                        />
                      ))
                    ) : (
                      <p className="px-1 py-3 text-center text-[12px] text-[var(--eos-muted)]">{stack.empty}</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {pulseAfterStacks ? pulseSlot : null}
        </div>
      )}
    </section>
  );
}
