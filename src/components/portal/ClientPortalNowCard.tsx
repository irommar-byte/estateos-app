"use client";

import { ArrowRight, CalendarCheck2, Clock3, MessageCircle, Phone, Sparkles, CheckCircle2 } from "lucide-react";
import { usePortalLocale } from "@/components/portal/PortalLocale";
import { PORTAL_TR_PL, type PortalTr } from "@/i18n/portal/translate";

/**
 * Pierwsza karta panelu klienta: co się teraz dzieje i co (jeśli cokolwiek) klient ma zrobić.
 * Jedna główna akcja — reszta panelu to szczegóły.
 */

type Slot = {
  startsAt: string;
  status: "confirmed" | "pending";
  proposedBy: "agent" | "client";
  location?: string | null;
  heldAt?: string | null;
};

export type PortalNowInput = {
  type: "BUYER" | "SELLER";
  clientFirstName: string;
  agentName: string;
  agentPhone: string | null;
  presentation: Slot | null;
  meeting: Slot | null;
  hasCheckback: boolean;
  unreadAgentReplies: number;
  pendingOfferCount: number;
  totalOfferCount: number;
  awaitingFirstOffer: boolean;
  firstOfferPendingAgent: boolean;
  pendingDecisionTitle: string | null;
  agreementSigned: boolean;
  hasAgreement: boolean;
  listingLive: boolean;
  purchasePhase: "viewed" | "negotiating" | "closed" | null;
};

type NowState = {
  tone: "action" | "info" | "done";
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; target: string };
};

function isUpcoming(slot: Slot | null): boolean {
  if (!slot || slot.heldAt) return false;
  const at = new Date(slot.startsAt).getTime();
  return Number.isFinite(at) && at > Date.now() - 2 * 60 * 60 * 1000;
}

export function resolvePortalNow(input: PortalNowInput, tr: PortalTr = PORTAL_TR_PL): NowState {
  const { t, p, dateLocale } = tr;
  const agentFirst = input.agentName.split(" ")[0] || input.agentName;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  if (input.presentation && isUpcoming(input.presentation) && input.presentation.status === "pending" && input.presentation.proposedBy === "agent") {
    return {
      tone: "action",
      eyebrow: t("Do zrobienia"),
      title: t("Wybierz termin oglądania"),
      body: t("{agent} proponuje termin. Potwierdź go jednym kliknięciem albo zaproponuj inny.", { agent: agentFirst }),
      cta: { label: t("Wybierz termin"), target: "portal-presentation" },
    };
  }
  if (input.meeting && isUpcoming(input.meeting) && input.meeting.status === "pending" && input.meeting.proposedBy === "agent") {
    return {
      tone: "action",
      eyebrow: t("Do zrobienia"),
      title: t("Potwierdź spotkanie"),
      body: `${when(input.meeting.startsAt)}${input.meeting.location ? ` · ${input.meeting.location}` : ""}`,
      cta: { label: t("Potwierdź termin"), target: "portal-meeting" },
    };
  }
  if (input.hasCheckback) {
    return {
      tone: "action",
      eyebrow: t("Do zrobienia"),
      title: t("{agent} ma do Ciebie pytanie", { agent: agentFirst }),
      body: t("Jedna odpowiedź pomoże lepiej dobrać kolejne propozycje."),
      cta: { label: t("Odpowiedz"), target: "portal-checkback" },
    };
  }
  if (input.pendingDecisionTitle) {
    return {
      tone: "action",
      eyebrow: t("Twoja decyzja"),
      title: input.pendingDecisionTitle,
      body: t("{agent} czeka na Twoją decyzję, żeby przejść dalej.", { agent: agentFirst }),
      cta: { label: t("Zobacz i zdecyduj"), target: "portal-decisions" },
    };
  }
  if (input.unreadAgentReplies > 0) {
    return {
      tone: "action",
      eyebrow: t("Nowa odpowiedź"),
      title: t("Masz nową odpowiedź od agenta"),
      body: t("Odpowiedź na Twoje pytanie o ofertę czeka poniżej."),
      cta: { label: t("Przeczytaj"), target: "portal-replies" },
    };
  }
  if (input.type === "BUYER" && input.pendingOfferCount > 0) {
    const n = input.pendingOfferCount;
    return {
      tone: "action",
      eyebrow: t("Do zrobienia"),
      title: t("Oceń {n} {items}", { n, items: p(n, "nową propozycję|nowe propozycje|nowych propozycji") }),
      body: t("Kliknij „Chcę oglądać”, „Do przemyślenia” albo „Nie pasuje”. Po każdej ocenie {agent} lepiej wie, czego szukasz.", { agent: agentFirst }),
      cta: { label: t("Zobacz propozycje"), target: "portal-offers" },
    };
  }
  if (input.presentation && isUpcoming(input.presentation)) {
    return {
      tone: "info",
      eyebrow: input.presentation.status === "confirmed" ? t("Oglądanie potwierdzone") : t("Czekamy na agenta"),
      title: when(input.presentation.startsAt),
      body: input.presentation.status === "confirmed"
        ? input.presentation.location || t("Szczegóły i dojazd poniżej.")
        : t("{agent} potwierdzi zaproponowany przez Ciebie termin.", { agent: agentFirst }),
      cta: { label: t("Szczegóły"), target: "portal-presentation" },
    };
  }
  if (input.meeting && isUpcoming(input.meeting)) {
    return {
      tone: "info",
      eyebrow: input.meeting.status === "confirmed" ? t("Spotkanie potwierdzone") : t("Czekamy na agenta"),
      title: when(input.meeting.startsAt),
      body: input.meeting.location || t("Szczegóły spotkania poniżej."),
      cta: { label: t("Szczegóły"), target: "portal-meeting" },
    };
  }
  if (input.purchasePhase === "closed") {
    return {
      tone: "done",
      eyebrow: t("Gratulacje"),
      title: t("Nieruchomość jest Twoja"),
      body: t("{agent} domyka formalności i przekazanie kluczy.", { agent: agentFirst }),
    };
  }
  if (input.purchasePhase === "negotiating") {
    return {
      tone: "info",
      eyebrow: t("Transakcja"),
      title: t("Trwają ustalenia warunków"),
      body: t("{agent} prowadzi rozmowy. Dostaniesz informację, gdy będzie potrzebny Twój podpis.", { agent: agentFirst }),
    };
  }
  if (input.type === "BUYER") {
    if (input.firstOfferPendingAgent) {
      return {
        tone: "info",
        eyebrow: t("Pracujemy dla Ciebie"),
        title: t("Pierwsza propozycja jest już u agenta"),
        body: t("{agent} ją sprawdza. Pojawi się tutaj, gdy ją zatwierdzi — dostaniesz też wiadomość.", { agent: agentFirst }),
      };
    }
    if (input.awaitingFirstOffer || input.totalOfferCount === 0) {
      return {
        tone: "info",
        eyebrow: t("Pracujemy dla Ciebie"),
        title: t("Szukamy nieruchomości pod Twoje kryteria"),
        body: t("Gdy znajdziemy coś wartego uwagi, zobaczysz to tutaj i dostaniesz wiadomość. Nic nie musisz robić."),
      };
    }
    return {
      tone: "done",
      eyebrow: t("Wszystko ocenione"),
      title: t("Dziękujemy za oceny"),
      body: t("{agent} szuka kolejnych dopasowań. Damy znać, gdy pojawi się coś nowego.", { agent: agentFirst }),
      cta: { label: t("Twoje propozycje"), target: "portal-offers" },
    };
  }
  if (!input.agreementSigned) {
    return {
      tone: "info",
      eyebrow: t("Przygotowanie"),
      title: input.hasAgreement ? t("Umowa jest gotowa do przejrzenia") : t("Agent przygotowuje umowę"),
      body: input.hasAgreement
        ? t("Zapoznaj się z warunkami współpracy przed podpisem.")
        : t("Po spotkaniu zobaczysz tutaj warunki współpracy i dokument do podpisu."),
      cta: input.hasAgreement ? { label: t("Zobacz umowę"), target: "portal-agreement" } : undefined,
    };
  }
  return {
    tone: input.listingLive ? "done" : "info",
    eyebrow: input.listingLive ? t("Sprzedaż trwa") : t("Przygotowanie ogłoszenia"),
    title: input.listingLive ? t("Ogłoszenie jest aktywne") : t("Agent przygotowuje ogłoszenie"),
    body: input.listingLive
      ? t("Postępy promocji i zainteresowanie kupujących widzisz poniżej.")
      : t("Ogłoszenie zobaczysz tutaj po aktywacji — dostaniesz powiadomienie."),
    cta: input.listingLive ? { label: t("Zobacz sprzedaż"), target: "portal-listing" } : undefined,
  };
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ClientPortalNowCard({ input }: { input: PortalNowInput }) {
  const tr = usePortalLocale();
  const now = resolvePortalNow(input, tr);
  const Icon = now.tone === "action" ? Sparkles : now.tone === "done" ? CheckCircle2 : input.presentation || input.meeting ? CalendarCheck2 : Clock3;
  const accent =
    now.tone === "action"
      ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/14 via-emerald-500/6 to-transparent"
      : now.tone === "done"
        ? "border-emerald-500/25 bg-emerald-500/6"
        : "border-[var(--eos-border)] bg-[var(--eos-card)]";

  return (
    <section
      aria-labelledby="portal-now-title"
      className={`rounded-[1.75rem] border p-6 shadow-[0_18px_48px_rgba(15,23,42,0.10)] sm:p-7 ${accent}`}
    >
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span>{now.eyebrow}</span>
      </p>
      <h1 id="portal-now-title" className="mt-3 text-[1.65rem] font-black leading-tight tracking-tight text-[var(--eos-text)] sm:text-3xl">
        {now.title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--eos-muted)]">{now.body}</p>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {now.cta ? (
          <button
            type="button"
            onClick={() => scrollToId(now.cta!.target)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-[15px] font-black text-emerald-950 shadow-[0_10px_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 active:scale-[0.98]"
          >
            {now.cta.label}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : null}
        <div className="flex gap-2.5">
          {input.agentPhone ? (
            <a
              href={`tel:${input.agentPhone.replace(/[^\d+]/g, "")}`}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 text-sm font-bold text-[var(--eos-text)] transition hover:border-emerald-500/40 sm:flex-none"
            >
              <Phone className="size-4 text-emerald-600" aria-hidden />
              {tr.t("Zadzwoń")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => scrollToId("portal-chat")}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 text-sm font-bold text-[var(--eos-text)] transition hover:border-emerald-500/40 sm:flex-none"
          >
            <MessageCircle className="size-4 text-emerald-600" aria-hidden />
            {tr.t("Napisz")}
          </button>
        </div>
      </div>
    </section>
  );
}
