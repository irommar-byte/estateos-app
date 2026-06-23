"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  Percent,
  Phone,
  Send,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { LEAD_CONDITION_CATALOG, LEAD_SERVICE_PRESETS, parseLeadConditions, serializeLeadConditions } from "@/lib/leadTransferShared";

export type EnrichedLead = {
  id: number;
  offerId: number;
  ownerId: number;
  agencyId: number;
  status: string;
  commissionRate: number | null;
  commissionTerms: string | null;
  createdAt: string;
  updatedAt: string;
  statusMeta: { label: string; step: number; hint: string };
  offer: {
    id: number;
    title: string;
    price: number;
    pricePln?: number;
    city: string | null;
    district: string | null;
    area: string | null;
    rooms: number | null;
    propertyType: string | null;
    transactionType: string | null;
    status: string;
    imageUrl: string;
    locationLabel: string;
    href: string;
  };
  owner: { id: number; name: string; email: string; phone: string | null; image: string | null };
  agency: { id: number; name: string; image: string | null; phone: string | null };
};

type Props = {
  leads: EnrichedLead[];
  isAgency: boolean;
  currentUserId?: number;
  onRefresh?: () => void;
};

const STEPS = ["Zapytanie", "Analiza", "Warunki", "Przekazanie"];

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

function OfferPreviewCard({ offer }: { offer: EnrichedLead["offer"] }) {
  return (
    <Link
      href={offer.href}
      target="_blank"
      className="group flex gap-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/50 p-3 transition hover:border-emerald-500/30"
    >
      <div
        className="size-24 shrink-0 rounded-xl bg-cover bg-center sm:size-28"
        style={{ backgroundImage: `url(${offer.imageUrl || "/placeholder.jpg"})` }}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-black text-[var(--eos-text)] group-hover:text-emerald-500">
          {offer.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--eos-muted)]">
          <MapPin className="size-3.5 shrink-0 text-emerald-500" />
          <span className="truncate">{offer.locationLabel}</span>
        </p>
        <p className="mt-2 text-lg font-black text-[var(--eos-text)]">{fmtPrice(offer.pricePln ?? offer.price)}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
          {offer.area ? <span>{offer.area} m²</span> : null}
          {offer.rooms ? <span>{offer.rooms} pok.</span> : null}
          <span>{offer.status}</span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
          Podgląd ogłoszenia <ExternalLink className="size-3" />
        </span>
      </div>
    </Link>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-4 flex flex-wrap gap-2">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const active = step >= idx;
        const current = step === idx;
        return (
          <li
            key={label}
            className={[
              "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest",
              active ? "bg-emerald-500/15 text-emerald-500" : "bg-[var(--eos-input)] text-[var(--eos-subtle)]",
              current ? "ring-1 ring-emerald-500/40" : "",
            ].join(" ")}
          >
            {idx}. {label}
          </li>
        );
      })}
    </ol>
  );
}

export default function CrmLeadInbox({ leads, isAgency, currentUserId, onRefresh }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [commission, setCommission] = useState<Record<number, string>>({});
  const [terms, setTerms] = useState<Record<number, string>>({});
  const [selectedConditions, setSelectedConditions] = useState<Record<number, string[]>>({});
  const [error, setError] = useState("");

  const pending = useMemo(
    () =>
      leads.filter((l) =>
        isAgency
          ? ["PENDING", "USER_COUNTER"].includes(l.status)
          : ["PENDING", "TERMS_PROPOSED", "USER_COUNTER"].includes(l.status),
      ),
    [leads, isAgency],
  );

  const proposeTerms = async (lead: EnrichedLead) => {
    setBusy(lead.id);
    setError("");
    try {
      const conditionIds = selectedConditions[lead.id] || [];
      if (conditionIds.length < 3) {
        setError("Zaznacz co najmniej 3 konkretne warunki obsługi dla klienta.");
        return;
      }
      const commissionTerms = serializeLeadConditions(conditionIds, terms[lead.id]);
      const res = await fetch("/api/concierge/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          leadId: lead.id,
          status: "TERMS_PROPOSED",
          commissionRate: commission[lead.id] || "2.5",
          commissionTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nie udało się wysłać warunków.");
        return;
      }
      onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  const acceptTransfer = async (leadId: number) => {
    setBusy(leadId);
    setError("");
    try {
      const res = await fetch("/api/concierge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nie udało się zaakceptować.");
        return;
      }
      onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  const rejectLead = async (leadId: number) => {
    setBusy(leadId);
    setError("");
    try {
      const res = await fetch("/api/concierge/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nie udało się odrzucić.");
        return;
      }
      onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-[2rem] border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-[var(--eos-card)]">
      <div className="border-b border-amber-500/15 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Briefcase className="size-5 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-500">
                Concierge · przekazanie sprzedaży
              </p>
            </div>
            <h3 className="text-xl font-black tracking-tight text-[var(--eos-text)] sm:text-2xl">
              {isAgency ? "Zapytania o przejęcie ofert" : "Przekazanie do agencji"}
            </h3>
            <p className="eos-muted-copy mt-2 max-w-2xl text-sm leading-relaxed">
              {isAgency
                ? "Właściciel prosi o profesjonalną obsługę. Przejrzyj ogłoszenie, zaproponuj prowizję i zakres usług — klient dostanie powiadomienie natychmiast."
                : "Agencja przygotowała warunki. Po akceptacji przejmuje kontakt z kupującymi — Ty zachowujesz podgląd statystyk i zmian ceny bez obowiązku odbierania telefonów."}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/60 px-4 py-3 text-xs text-[var(--eos-muted)]">
            <p className="flex items-center gap-2 font-bold text-[var(--eos-text)]">
              <Shield className="size-4 text-emerald-500" />
              Jak to działa?
            </p>
            <ul className="mt-2 space-y-1.5 leading-relaxed">
              <li>1. Wybierasz zaufaną agencję</li>
              <li>2. Biuro analizuje ofertę i proponuje warunki</li>
              <li>3. Akceptujesz — sprzedażą zajmuje się ekspert</li>
            </ul>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mx-6 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 sm:mx-8">
          {error}
        </p>
      ) : null}

      <div className="space-y-5 p-6 sm:p-8">
        {pending.map((lead) => (
          <article
            key={lead.id}
            className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                  Zapytanie #{lead.id} · {new Date(lead.createdAt).toLocaleDateString("pl-PL")}
                </p>
                <p className="mt-1 text-sm font-bold text-emerald-500">{lead.statusMeta.label}</p>
                <p className="eos-muted-copy mt-1 text-xs">{lead.statusMeta.hint}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                <Home className="size-3.5" />
                Oferta #{lead.offerId}
              </div>
            </div>

            <Stepper step={lead.statusMeta.step} />

            <OfferPreviewCard offer={lead.offer} />

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/40 px-4 py-3">
              {isAgency ? (
                <>
                  <User className="size-4 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Właściciel</p>
                    <p className="font-bold text-[var(--eos-text)]">{lead.owner.name}</p>
                    {lead.owner.phone ? (
                      <p className="flex items-center gap-1 text-xs text-[var(--eos-muted)]">
                        <Phone className="size-3" /> {lead.owner.phone}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <Building2 className="size-4 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Agencja</p>
                    <p className="font-bold text-[var(--eos-text)]">{lead.agency.name}</p>
                  </div>
                </>
              )}
            </div>

            {isAgency ? (
              <div className="mt-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                  Konkretne warunki współpracy (właściciel zaakceptuje każdy punkt)
                </p>
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--eos-muted)]">
                      <Percent className="size-3" /> Prowizja
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="10"
                      placeholder="2.5"
                      value={commission[lead.id] ?? ""}
                      onChange={(e) => setCommission((p) => ({ ...p, [lead.id]: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[var(--eos-muted)]">
                      Uwagi dodatkowe (opcjonalnie)
                    </span>
                    <textarea
                      rows={2}
                      placeholder="Np. wyłączność, minimalny czas umowy…"
                      value={terms[lead.id] ?? ""}
                      onChange={(e) => setTerms((p) => ({ ...p, [lead.id]: e.target.value }))}
                      className="w-full resize-none rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {LEAD_CONDITION_CATALOG.map((item) => {
                    const checked = (selectedConditions[lead.id] || []).includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                          checked
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-[var(--eos-border)] bg-[var(--eos-input)]/40",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedConditions((prev) => {
                              const current = prev[lead.id] || [];
                              const next = e.target.checked
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id);
                              return { ...prev, [lead.id]: next };
                            });
                          }}
                          className="mt-0.5 accent-emerald-500"
                        />
                        <span className="leading-snug text-[var(--eos-text)]">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {LEAD_SERVICE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSelectedConditions((p) => ({
                          ...p,
                          [lead.id]: LEAD_CONDITION_CATALOG.map((c) => c.id),
                        }));
                        setTerms((p) => ({ ...p, [lead.id]: preset }));
                      }}
                      className="rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-left text-[10px] font-semibold text-[var(--eos-muted)] hover:border-emerald-500/30 hover:text-emerald-500"
                    >
                      Zaznacz pełny pakiet
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === lead.id}
                    onClick={() => void proposeTerms(lead)}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    {busy === lead.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Wyślij warunki do klienta
                  </button>
                  <button
                    type="button"
                    disabled={busy === lead.id}
                    onClick={() => void rejectLead(lead.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]"
                  >
                    <XCircle className="size-3.5" />
                    Odrzuć zapytanie
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                {lead.commissionRate != null ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                    <p className="flex items-center gap-2 text-sm font-bold text-[var(--eos-text)]">
                      <Percent className="size-4 text-emerald-500" />
                      Prowizja przy udanej transakcji: {lead.commissionRate}%
                    </p>
                    {(() => {
                      const parsed = parseLeadConditions(lead.commissionTerms);
                      if (parsed.conditions.length > 0) {
                        return (
                          <div className="mt-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                              Agencja zobowiązuje się do:
                            </p>
                            <ol className="mt-3 space-y-2">
                              {parsed.conditions.map((c, i) => (
                                <li
                                  key={c.id}
                                  className="flex gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/60 px-3 py-2.5 text-sm text-[var(--eos-text)]"
                                >
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-black text-emerald-600">
                                    {i + 1}
                                  </span>
                                  <span className="leading-relaxed">{c.label}</span>
                                </li>
                              ))}
                            </ol>
                            {parsed.customNote ? (
                              <p className="eos-muted-copy mt-3 text-xs leading-relaxed">
                                <span className="font-bold text-[var(--eos-text)]">Uwagi: </span>
                                {parsed.customNote}
                              </p>
                            ) : null}
                          </div>
                        );
                      }
                      if (parsed.rawText) {
                        return (
                          <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{parsed.rawText}</p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : lead.status === "PENDING" ? (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm leading-relaxed text-[var(--eos-muted)]">
                    <p className="font-bold text-[var(--eos-text)]">Zlecenie w analizie</p>
                    <p className="mt-2">
                      Agencja przejrzy Twoje ogłoszenie i prześle konkretną listę warunków współpracy.
                      Twoja oferta pozostaje u Ciebie — nic się nie zmienia bez Twojej akceptacji.
                    </p>
                  </div>
                ) : null}

                {lead.status === "TERMS_PROPOSED" ? (
                  <p className="mt-4 text-xs leading-relaxed text-[var(--eos-muted)]">
                    Akceptując, przekazujesz sprzedaż agencji na powyższych warunkach. Zachowujesz podgląd
                    oferty i statystyk — bez obowiązku kontaktu z kupującymi.
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {lead.status === "TERMS_PROPOSED" ? (
                    <button
                      type="button"
                      disabled={busy === lead.id}
                      onClick={() => void acceptTransfer(lead.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-black"
                    >
                      <CheckCircle2 className="size-4" />
                      Akceptuję powyższe warunki i przekazuję sprzedaż
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy === lead.id}
                    onClick={() => void rejectLead(lead.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]"
                  >
                    <XCircle className="size-3.5" />
                    Odrzuć propozycję
                  </button>
                  <Link
                    href={lead.offer.href}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[var(--eos-text)]"
                  >
                    Podgląd ogłoszenia <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
