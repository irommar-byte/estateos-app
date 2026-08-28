"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, HelpCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import SendPlaneButton from "@/components/ui/SendPlaneButton";
import { OfferDescriptionToggle, OfferPhotoCascade } from "@/components/crm/OfferPreviewExpand";
import {
  DISLIKE_PHRASES,
  LIKE_PHRASES,
  mergeFeedbackPhrases,
  parseClientOfferFeedback,
  splitFeedbackPhrases,
  type ClientOfferSentiment,
} from "@/lib/crm/clientPortalFeedback";

type Match = {
  id: number;
  score: number;
  notifiedAt: string | null;
  clientFeedback: string | null;
  clientFeedbackAt: string | null;
  intelligenceSent?: boolean;
  intelligenceReason?: string | null;
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

function scoreTone(score: number) {
  if (score >= 85) return { bar: "bg-emerald-500", text: "text-emerald-600", label: "Bardzo dobre dopasowanie" };
  if (score >= 70) return { bar: "bg-lime-500", text: "text-lime-700", label: "Dobre dopasowanie" };
  if (score >= 55) return { bar: "bg-amber-400", text: "text-amber-700", label: "Częściowe dopasowanie" };
  return { bar: "bg-rose-500", text: "text-rose-600", label: "Słabe dopasowanie" };
}

function sentimentBadge(sentiment: ClientOfferSentiment | null, hasFeedback: boolean) {
  if (!hasFeedback) return { label: "Nowe", className: "eos-lux-badge" };
  if (sentiment === "like") return { label: "Chcę oglądać", className: "eos-lux-badge eos-lux-badge--ok" };
  if (sentiment === "maybe") return { label: "Do przemyślenia", className: "eos-lux-badge eos-lux-badge--warn" };
  if (sentiment === "dislike") return { label: "Odłożone", className: "eos-lux-badge eos-lux-badge--danger" };
  return { label: "Odpowiedź u agenta", className: "eos-lux-badge eos-lux-badge--info" };
}

function phraseInSet(phrase: string, set: readonly string[]) {
  return set.includes(phrase);
}

export default function ClientPortalMatchCard({
  match,
  token,
  saving,
  expanded,
  onToggle,
  prefill,
  onSubmit,
}: {
  match: Match;
  token: string;
  saving: boolean;
  expanded: boolean;
  onToggle: () => void;
  prefill?: { sentiment?: ClientOfferSentiment | null; phrase?: string | null };
  onSubmit: (payload: {
    sentiment: ClientOfferSentiment | null;
    liked: string;
    disliked: string;
    phrases: string[];
    note: string;
  }) => Promise<void>;
}) {
  const saved = useMemo(() => parseClientOfferFeedback(match.clientFeedback), [match.clientFeedback]);
  const initialPhrases = useMemo(() => splitFeedbackPhrases(saved.phrases), [saved.phrases]);
  const [sentiment, setSentiment] = useState<ClientOfferSentiment | null>(saved.sentiment);
  const [liked, setLiked] = useState(saved.liked);
  const [disliked, setDisliked] = useState(saved.disliked);
  const [likedPhrases, setLikedPhrases] = useState<string[]>(initialPhrases.likedPhrases);
  const [dislikedPhrases, setDislikedPhrases] = useState<string[]>(initialPhrases.dislikedPhrases);
  const [note, setNote] = useState(saved.note);
  const href = `/oferta/${match.offer.id}?portal=${encodeURIComponent(token)}`;
  const tone = scoreTone(match.score);
  const location = [match.offer.city, match.offer.district, match.offer.street].filter(Boolean).join(" · ");
  const phrases = useMemo(() => mergeFeedbackPhrases(likedPhrases, dislikedPhrases), [likedPhrases, dislikedPhrases]);
  const canSend = Boolean(sentiment || liked.trim() || disliked.trim() || phrases.length || note.trim());
  const emailConfirmPending = Boolean(!match.clientFeedback && (prefill?.sentiment || prefill?.phrase));
  const badge = sentimentBadge(sentiment, Boolean(match.clientFeedback));
  const showLikePanel = sentiment !== "dislike";
  const showDislikePanel = sentiment !== "like";

  useEffect(() => {
    if (!prefill) return;
    if (prefill.sentiment) setSentiment(prefill.sentiment);
    if (prefill.phrase) {
      if (phraseInSet(prefill.phrase, LIKE_PHRASES)) {
        setLikedPhrases((current) =>
          current.includes(prefill.phrase!) ? current : [...current, prefill.phrase!],
        );
      } else if (phraseInSet(prefill.phrase, DISLIKE_PHRASES)) {
        setDislikedPhrases((current) =>
          current.includes(prefill.phrase!) ? current : [...current, prefill.phrase!],
        );
      }
    }
  }, [prefill]);

  const toggleLikedPhrase = (phrase: string) => {
    setLikedPhrases((current) =>
      current.includes(phrase) ? current.filter((item) => item !== phrase) : [...current, phrase],
    );
  };

  const toggleDislikedPhrase = (phrase: string) => {
    setDislikedPhrases((current) =>
      current.includes(phrase) ? current.filter((item) => item !== phrase) : [...current, phrase],
    );
  };

  const submitPayload = {
    sentiment,
    liked,
    disliked,
    phrases,
    note,
  };

  return (
    <article
      className={`eos-inset-frame rounded-[1.6rem] ${match.intelligenceSent ? "eos-intel-frame" : "overflow-hidden"}`}
    >
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <OfferPhotoCascade
          offer={match.offer}
          onOpen={expanded ? undefined : onToggle}
          thumbClassName="eos-inset-well block h-20 w-20 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-28"
        />
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className={badge.className}>{badge.label}</span>
            {match.intelligenceSent ? (
              <span className="eos-intel-kicker text-[9px] font-black uppercase tracking-[0.14em]">
                Intelligence
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-black leading-snug text-[var(--eos-text)] sm:text-base">
            {match.offer.title}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
            {Math.round(match.offer.price).toLocaleString("pl-PL")} {match.offer.priceCurrency || "PLN"}
            {match.offer.area ? ` · ${match.offer.area} m²` : ""}
            {match.offer.rooms ? ` · ${match.offer.rooms} pok.` : ""}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--eos-muted)]">{location}</p>
          {!expanded ? (
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--eos-subtle)]">
              Zdjęcie = galeria · początek opisu = szybki podgląd
            </p>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="eos-raised-chip mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full"
          aria-expanded={expanded}
          aria-label={expanded ? "Zwiń ofertę" : "Rozwiń ofertę"}
        >
          <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-[rgba(196,163,90,0.16)] px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="pt-3">
            <OfferDescriptionToggle
              offer={match.offer}
              hint
              className="text-sm leading-relaxed text-[var(--eos-muted)]"
            />
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                <span className={tone.text}>
                  {match.score}% · {tone.label}
                </span>
                {match.notifiedAt ? (
                  <span className="text-[var(--eos-muted)]">
                    Wysłane {new Date(match.notifiedAt).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : null}
              </div>
              <div className="eos-inset-well mt-1.5 h-2.5 overflow-hidden rounded-full">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(8, Math.min(100, match.score))}%` }} />
              </div>
            </div>
            <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline">
              Otwórz ogłoszenie <ExternalLink className="size-3" />
            </Link>
          </div>

          <div className="eos-portal-react mt-4 rounded-2xl p-4 sm:p-5">
            {emailConfirmPending ? (
              <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm font-black text-[var(--eos-text)]">Potwierdź wybór z maila</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
                  Nic jeszcze nie poszło do agenta — jeden tap i ta reakcja ląduje u niego.
                </p>
                <SendPlaneButton
                  sending={saving}
                  disabled={saving || !canSend}
                  onClick={() => void onSubmit(submitPayload)}
                  className="mt-3"
                >
                  Potwierdź i wyślij agentowi
                </SendPlaneButton>
              </div>
            ) : null}

            <div className="mb-4 flex items-start gap-2.5">
              <span className="eos-live-dot mt-1.5 shrink-0" aria-hidden />
              <div>
                <p className="eos-portal-label eos-portal-label--ok">
                  {match.clientFeedback ? "Twoja reakcja" : "Jak oceniasz tę ofertę?"}
                </p>
                <p className="mt-1 text-sm leading-snug text-[var(--eos-text)]">
                  {match.clientFeedback
                    ? "Możesz doprecyzować — agent nadal widzi tę samą nieruchomość."
                    : "Wybierz decyzję, potem zaznacz plusy i minusy w osobnych sekcjach."}
                </p>
              </div>
            </div>

            <p className="eos-portal-label mb-2">Decyzja</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "like" as const, label: "Chcę oglądać", icon: ThumbsUp, on: "eos-choice-btn--on" },
                  { id: "maybe" as const, label: "Do przemyślenia", icon: HelpCircle, on: "eos-choice-btn--maybe" },
                  { id: "dislike" as const, label: "Odłóż", icon: ThumbsDown, on: "eos-choice-btn--off" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSentiment(option.id)}
                  className={`eos-choice-btn flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] ${
                    sentiment === option.id ? option.on : ""
                  }`}
                >
                  <option.icon className="mb-1 size-4" />
                  {option.label}
                </button>
              ))}
            </div>

            {!sentiment ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--eos-border)] px-3 py-2.5 text-center text-[11px] text-[var(--eos-muted)]">
                Po wyborze decyzji pokażemy sekcje „Pasuje mi” i „Nie pasuje”.
              </p>
            ) : (
              <div
                className={`mt-4 grid gap-3 ${showLikePanel && showDislikePanel ? "lg:grid-cols-2" : "grid-cols-1"}`}
              >
                {showLikePanel ? (
                  <section className="portal-feedback-panel portal-feedback-panel--yes rounded-2xl p-3.5 sm:p-4">
                    <p className="eos-portal-label eos-portal-label--ok">Pasuje mi</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--eos-muted)]">
                      Zaznacz plusy albo dopisz własne.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {LIKE_PHRASES.map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => toggleLikedPhrase(phrase)}
                          className={`eos-raised-chip rounded-full px-3 py-1.5 text-[11px] ${
                            likedPhrases.includes(phrase) ? "eos-raised-chip--on" : ""
                          }`}
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={liked}
                      onChange={(event) => setLiked(event.target.value)}
                      rows={2}
                      placeholder="Np. kuchnia od ogrodu, cisza…"
                      className="eos-field-inset mt-2.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-[var(--eos-text)]"
                    />
                  </section>
                ) : null}

                {showDislikePanel ? (
                  <section className="portal-feedback-panel portal-feedback-panel--no rounded-2xl p-3.5 sm:p-4">
                    <p className="eos-portal-label eos-portal-label--no">Nie pasuje</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--eos-muted)]">
                      Zaznacz minusy albo dopisz własne.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {DISLIKE_PHRASES.map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => toggleDislikedPhrase(phrase)}
                          className={`eos-raised-chip rounded-full px-3 py-1.5 text-[11px] ${
                            dislikedPhrases.includes(phrase) ? "eos-raised-chip--no" : ""
                          }`}
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={disliked}
                      onChange={(event) => setDisliked(event.target.value)}
                      rows={2}
                      placeholder="Np. za mała kuchnia, hałas…"
                      className="eos-field-inset mt-2.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-[var(--eos-text)]"
                    />
                  </section>
                ) : null}
              </div>
            )}

            <label className="eos-portal-label mt-4 block">Wiadomość do agenta (opcjonalnie)</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Krótka notatka — np. kiedy możesz na oglądania"
              className="eos-field-inset mt-2 w-full rounded-xl px-4 py-3 text-sm text-[var(--eos-text)]"
            />

            <SendPlaneButton
              sending={saving}
              disabled={saving || !canSend}
              onClick={() => void onSubmit(submitPayload)}
              className="mt-4"
            >
              {match.clientFeedback ? "Zaktualizuj reakcję" : "Wyślij reakcję do agenta"}
            </SendPlaneButton>
            {!canSend ? (
              <p className="mt-2 text-center text-[11px] text-[var(--eos-muted)]">
                Wybierz decyzję albo uzupełnij sekcję plusów / minusów.
              </p>
            ) : null}
            {match.clientFeedbackAt ? (
              <p className="mt-2 text-center text-[11px] text-[var(--eos-muted)]">
                Ostatnia reakcja: {new Date(match.clientFeedbackAt).toLocaleString("pl-PL")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
