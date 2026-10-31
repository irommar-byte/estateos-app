"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  HelpCircle,
  Inbox,
  LayoutList,
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
  computePortalOfferStats,
  defaultOpenStacks,
  formatPortalWhen,
  groupPortalOfferStacks,
  resolveAssistantPulse,
  stackIdFromSentiment,
  type OfferStackId,
  type PortalBoardActivity,
  type PortalTimelineItem,
} from "@/lib/crm/clientPortalOfferBoard";
import { usePortalLocale } from "@/components/portal/PortalLocale";

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

const HISTORY_PREVIEW = 6;

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
  intelligenceEnabled,
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
  onOpenSheet,
}: {
  onOpenSheet?: (matchId: number) => void;
  token: string;
  matches: PortalMatch[];
  activities: PortalBoardActivity[];
  intelligenceEnabled: boolean;
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
  const loc = usePortalLocale();
  const { t } = loc;
  const stats = useMemo(() => computePortalOfferStats(matches), [matches]);
  const stacks = useMemo(() => groupPortalOfferStacks(matches), [matches]);
  const timeline = useMemo(() => buildPortalTimeline(matches, activities, loc), [matches, activities, loc]);
  const pulse = useMemo(
    () =>
      resolveAssistantPulse({
        intelligenceEnabled,
        pendingNewCount: stats.pending,
        unscoredCount,
        pendingCheckback,
      }, loc),
    [intelligenceEnabled, stats.pending, unscoredCount, pendingCheckback, loc],
  );
  const pulseBeforeStacks = Boolean(pulse && pulse.mode !== "waiting_reaction");
  const pulseAfterStacks = pulse?.mode === "waiting_reaction";

  const [view, setView] = useState<ViewMode>("stacks");
  const [historyAll, setHistoryAll] = useState(false);
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
    <ClientPortalUpcomingOfferSlot pulse={pulse} onFocusNew={focusNewOffers} />
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
      {freshBanner ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-[var(--eos-text)]">
          {t("Nowa propozycja do oceny:")} {freshBanner}
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
            {t("Oferty")}
          </button>
          <button
            type="button"
            onClick={() => setView("timeline")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
              view === "timeline" ? "bg-emerald-500 text-white" : "text-[var(--eos-muted)]"
            }`}
          >
            <CalendarClock className="size-3.5" />
            {t("Historia")}
          </button>
        </div>
      </div>

      {matches.length === 0 ? (
        awaitingFirstOffer ? (
          <ClientPortalOfferSearchPanel unscoredCount={unscoredCount} />
        ) : (
          <div className="eos-inset-well rounded-2xl border border-dashed border-[var(--eos-border)] p-8 text-center">
            <p className="text-sm font-semibold text-[var(--eos-text)]">{t("Nie ma jeszcze ofert")}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              {t("Gdy agent udostępni ofertę, zobaczysz ją tutaj.")}
            </p>
          </div>
        )
      ) : view === "timeline" ? (
        <div className="eos-inset-frame rounded-[1.6rem] p-5 sm:p-6">
          <p className="eos-portal-label eos-portal-label--ok">{t("Historia współpracy")}</p>
          {timeline.length ? (
            <ol className="relative mt-5 ml-2 space-y-4 border-l border-[var(--eos-border)] pl-5">
              {(historyAll ? timeline : timeline.slice(0, HISTORY_PREVIEW)).map((item) => (
                <li key={item.id} className="relative">
                  <TimelineDot tone={item.tone} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                    {formatPortalWhen(item.at, loc.dateLocale)}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--eos-text)]">{item.title}</p>
                  {item.body ? (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--eos-muted)]">{item.body}</p>
                  ) : null}
                  {item.matchId ? (
                    <button
                      type="button"
                      onClick={() => jumpToMatch(item.matchId)}
                      className="mt-1 text-[11px] font-bold text-[var(--lux-accent)] hover:underline"
                    >
                      {t("Pokaż ofertę")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-[var(--eos-muted)]">{t("Historia pojawi się po pierwszej wysłanej ofercie.")}</p>
          )}
          {timeline.length > HISTORY_PREVIEW ? (
            <button type="button" onClick={() => setHistoryAll((v) => !v)} className="mt-4 text-[12px] font-bold text-[var(--lux-gold-ink)]">
              {historyAll ? t("Pokaż mniej") : t("Pokaż całą historię ({n})", { n: timeline.length })}
            </button>
          ) : null}
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
                      <span className="text-sm font-black text-[var(--eos-text)]">{t(stack.title)}</span>
                      <span className="eos-lux-badge">{rows.length}</span>
                      {unreadCount ? (
                        <span className="rounded-full bg-[var(--lux-gold-soft)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--lux-gold-ink)]">
                          {t("{n} do przeczytania", { n: unreadCount })}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--eos-muted)]">{t(stack.hint)}</span>
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
                          onOpenSheet={onOpenSheet ? () => onOpenSheet(match.id) : undefined}
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
                      <p className="px-1 py-3 text-center text-[12px] text-[var(--eos-muted)]">{t(stack.empty)}</p>
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
