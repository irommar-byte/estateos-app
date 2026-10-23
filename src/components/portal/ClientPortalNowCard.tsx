"use client";

import { ArrowRight, CalendarCheck2, Clock3, MessageCircle, Phone, Sparkles, CheckCircle2 } from "lucide-react";
import { formatMeetingWhenPl } from "@/lib/datetime/warsaw";

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

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}

export function resolvePortalNow(input: PortalNowInput): NowState {
  const agentFirst = input.agentName.split(" ")[0] || input.agentName;

  if (input.presentation && isUpcoming(input.presentation) && input.presentation.status === "pending" && input.presentation.proposedBy === "agent") {
    return {
      tone: "action",
      eyebrow: "Do zrobienia",
      title: "Wybierz termin oglądania",
      body: `${agentFirst} proponuje termin. Potwierdź go jednym kliknięciem albo zaproponuj inny.`,
      cta: { label: "Wybierz termin", target: "portal-presentation" },
    };
  }
  if (input.meeting && isUpcoming(input.meeting) && input.meeting.status === "pending" && input.meeting.proposedBy === "agent") {
    return {
      tone: "action",
      eyebrow: "Do zrobienia",
      title: "Potwierdź spotkanie",
      body: `${formatMeetingWhenPl(input.meeting.startsAt)}${input.meeting.location ? ` · ${input.meeting.location}` : ""}`,
      cta: { label: "Potwierdź termin", target: "portal-meeting" },
    };
  }
  if (input.hasCheckback) {
    return {
      tone: "action",
      eyebrow: "Do zrobienia",
      title: `${agentFirst} ma do Ciebie pytanie`,
      body: "Jedna odpowiedź pomoże lepiej dobrać kolejne propozycje.",
      cta: { label: "Odpowiedz", target: "portal-checkback" },
    };
  }
  if (input.pendingDecisionTitle) {
    return {
      tone: "action",
      eyebrow: "Twoja decyzja",
      title: input.pendingDecisionTitle,
      body: `${agentFirst} czeka na Twoją decyzję, żeby przejść dalej.`,
      cta: { label: "Zobacz i zdecyduj", target: "portal-decisions" },
    };
  }
  if (input.unreadAgentReplies > 0) {
    return {
      tone: "action",
      eyebrow: "Nowa odpowiedź",
      title: "Masz nową odpowiedź od agenta",
      body: "Odpowiedź na Twoje pytanie o ofertę czeka poniżej.",
      cta: { label: "Przeczytaj", target: "portal-replies" },
    };
  }
  if (input.type === "BUYER" && input.pendingOfferCount > 0) {
    const n = input.pendingOfferCount;
    return {
      tone: "action",
      eyebrow: "Do zrobienia",
      title: `Oceń ${n} ${plural(n, "nową propozycję", "nowe propozycje", "nowych propozycji")}`,
      body: `Kliknij „Chcę obejrzeć”, „Do przemyślenia” albo „Nie pasuje”. Po każdej ocenie ${agentFirst} lepiej wie, czego szukasz.`,
      cta: { label: "Zobacz propozycje", target: "portal-offers" },
    };
  }
  if (input.presentation && isUpcoming(input.presentation)) {
    return {
      tone: "info",
      eyebrow: input.presentation.status === "confirmed" ? "Oglądanie potwierdzone" : "Czekamy na agenta",
      title: formatMeetingWhenPl(input.presentation.startsAt),
      body: input.presentation.status === "confirmed"
        ? input.presentation.location || "Szczegóły i dojazd poniżej."
        : `${agentFirst} potwierdzi zaproponowany przez Ciebie termin.`,
      cta: { label: "Szczegóły", target: "portal-presentation" },
    };
  }
  if (input.meeting && isUpcoming(input.meeting)) {
    return {
      tone: "info",
      eyebrow: input.meeting.status === "confirmed" ? "Spotkanie potwierdzone" : "Czekamy na agenta",
      title: formatMeetingWhenPl(input.meeting.startsAt),
      body: input.meeting.location || "Szczegóły spotkania poniżej.",
      cta: { label: "Szczegóły", target: "portal-meeting" },
    };
  }
  if (input.purchasePhase === "closed") {
    return {
      tone: "done",
      eyebrow: "Gratulacje",
      title: "Nieruchomość jest Twoja",
      body: `${agentFirst} domyka formalności i przekazanie kluczy.`,
    };
  }
  if (input.purchasePhase === "negotiating") {
    return {
      tone: "info",
      eyebrow: "Transakcja",
      title: "Trwają ustalenia warunków",
      body: `${agentFirst} prowadzi rozmowy. Dostaniesz informację, gdy będzie potrzebny Twój podpis.`,
    };
  }
  if (input.type === "BUYER") {
    if (input.firstOfferPendingAgent) {
      return {
        tone: "info",
        eyebrow: "Pracujemy dla Ciebie",
        title: "Pierwsza propozycja jest już u agenta",
        body: `${agentFirst} ją sprawdza. Pojawi się tutaj, gdy ją zatwierdzi — dostaniesz też wiadomość.`,
      };
    }
    if (input.awaitingFirstOffer || input.totalOfferCount === 0) {
      return {
        tone: "info",
        eyebrow: "Pracujemy dla Ciebie",
        title: "Szukamy nieruchomości pod Twoje kryteria",
        body: "Gdy znajdziemy coś wartego uwagi, zobaczysz to tutaj i dostaniesz wiadomość. Nic nie musisz robić.",
      };
    }
    return {
      tone: "done",
      eyebrow: "Wszystko ocenione",
      title: "Dziękujemy za oceny",
      body: `${agentFirst} szuka kolejnych dopasowań. Damy znać, gdy pojawi się coś nowego.`,
      cta: { label: "Twoje propozycje", target: "portal-offers" },
    };
  }
  if (!input.agreementSigned) {
    return {
      tone: "info",
      eyebrow: "Przygotowanie",
      title: input.hasAgreement ? "Umowa jest gotowa do przejrzenia" : "Agent przygotowuje umowę",
      body: input.hasAgreement
        ? "Zapoznaj się z warunkami współpracy przed podpisem."
        : "Po spotkaniu zobaczysz tutaj warunki współpracy i dokument do podpisu.",
      cta: input.hasAgreement ? { label: "Zobacz umowę", target: "portal-agreement" } : undefined,
    };
  }
  return {
    tone: input.listingLive ? "done" : "info",
    eyebrow: input.listingLive ? "Sprzedaż trwa" : "Przygotowanie ogłoszenia",
    title: input.listingLive ? "Ogłoszenie jest aktywne" : "Agent przygotowuje ogłoszenie",
    body: input.listingLive
      ? "Postępy promocji i zainteresowanie kupujących widzisz poniżej."
      : "Zdjęcia, opis i publikację zobaczysz tutaj, gdy będą gotowe.",
    cta: { label: "Zobacz sprzedaż", target: "portal-listing" },
  };
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ClientPortalNowCard({ input }: { input: PortalNowInput }) {
  const now = resolvePortalNow(input);
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
              Zadzwoń
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => scrollToId("portal-chat")}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 text-sm font-bold text-[var(--eos-text)] transition hover:border-emerald-500/40 sm:flex-none"
          >
            <MessageCircle className="size-4 text-emerald-600" aria-hidden />
            Napisz
          </button>
        </div>
      </div>
    </section>
  );
}
