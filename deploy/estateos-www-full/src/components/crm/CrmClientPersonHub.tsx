"use client";

import { Building2, ChevronRight, MessageSquare, Plus, Search } from "lucide-react";
import { eosBtn } from "@/components/ui/eosButtonStyles";

export type CrmPersonProject = {
  id: number;
  type: "BUYER" | "SELLER";
  title: string;
  subtitle: string;
  statusLabel: string;
  portalUnreadCount: number;
  linkedOfferId: number | null;
  matchCount: number;
  updatedAt: string;
};

export default function CrmClientPersonHub({
  selling,
  buying,
  view,
  lane,
  currentId,
  busy,
  onOpenLane,
  onBackToPerson,
  onOpenProject,
  onAddProject,
}: {
  selling: CrmPersonProject[];
  buying: CrmPersonProject[];
  view: "person" | "lane";
  lane: "SELL" | "BUY" | null;
  currentId: number;
  busy?: boolean;
  onOpenLane: (next: "SELL" | "BUY") => void;
  onBackToPerson: () => void;
  onOpenProject: (projectId: number) => void;
  onAddProject: (type: "BUYER" | "SELLER") => void;
}) {
  if (view === "lane" && lane) {
    const items = lane === "SELL" ? selling : buying;
    const isSell = lane === "SELL";
    return (
      <section className="space-y-4">
        <button type="button" onClick={onBackToPerson} className={eosBtn("secondary", { size: "sm" })}>
          Karty klienta
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
            {isSell ? "Sprzedaje" : "Kupuje"}
          </p>
          <h4 className="mt-1 text-xl font-bold text-[var(--eos-text)]">
            {isSell ? "Wybierz pozysk" : "Wybierz poszukiwanie"}
          </h4>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">
            {isSell
              ? "Każda nieruchomość to osobny projekt: umowa, ogłoszenie, promocje i live chat."
              : "Każde poszukiwanie ma własne kryteria, radar i live chat."}
          </p>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenProject(item.id)}
              className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 text-left transition hover:border-emerald-400/50"
            >
              <div className="min-w-0">
                <p className="font-bold text-[var(--eos-text)]">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{item.subtitle}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
                  {item.statusLabel}
                  {item.portalUnreadCount ? ` · czat ${item.portalUnreadCount}` : ""}
                </p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-[var(--eos-muted)]" />
            </button>
          ))}
          {!items.length ? (
            <p className="rounded-2xl border border-dashed border-[var(--eos-border)] p-4 text-sm text-[var(--eos-muted)]">
              {isSell ? "Brak pozysku sprzedaży." : "Brak aktywnego poszukiwania."}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onAddProject(isSell ? "SELLER" : "BUYER")}
            className={eosBtn("home", { size: "sm" })}
          >
            <Plus className="size-3.5" />
            {isSell ? "Nowy pozysk" : "Nowe poszukiwanie"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onOpenLane("SELL")}
        className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 text-left transition hover:border-emerald-400/40"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
            <Building2 className="size-5" />
          </span>
          <ChevronRight className="size-4 text-[var(--eos-muted)]" />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Sprzedaje</p>
        <h4 className="mt-1 text-lg font-bold text-[var(--eos-text)]">
          {selling.length ? `${selling.length} ${selling.length === 1 ? "pozysk" : "pozyski"}` : "Brak pozysku"}
        </h4>
        <p className="mt-1 text-sm text-[var(--eos-muted)]">
          {selling[0]?.title || "Umowa, ogłoszenie, promocje i czat w jednym projekcie."}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onOpenLane("BUY")}
        className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 text-left transition hover:border-emerald-400/40"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600">
            <Search className="size-5" />
          </span>
          <ChevronRight className="size-4 text-[var(--eos-muted)]" />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-sky-600">Kupuje</p>
        <h4 className="mt-1 text-lg font-bold text-[var(--eos-text)]">
          {buying.length ? `${buying.length} ${buying.length === 1 ? "poszukiwanie" : "poszukiwania"}` : "Brak poszukiwania"}
        </h4>
        <p className="mt-1 text-sm text-[var(--eos-muted)]">
          {buying[0]?.title || "Kryteria, radar i live chat jako osobny projekt."}
        </p>
        {buying.some((item) => item.id === currentId || item.portalUnreadCount) ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--eos-muted)]">
            <MessageSquare className="size-3.5" />
            Czat przy konkretnym poszukiwaniu
          </p>
        ) : null}
      </button>
    </section>
  );
}
