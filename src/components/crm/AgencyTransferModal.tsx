"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  Shield,
  Star,
  X,
} from "lucide-react";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";
import { eosBtn } from "@/components/ui/eosButtonStyles";

type Agency = {
  id: number;
  companyId?: number | null;
  displayName: string;
  image: string | null;
  averageRating: number | null;
  reviewsCount: number;
  activeListings: number;
  memberCount?: number;
  conciergeManaged?: number;
  companyAddress?: string | null;
  companyWebsite?: string | null;
  officePhone?: string | null;
};

type AgencyDetail = {
  displayName: string;
  image: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  stats: {
    activeListings: number;
    reviewsCount: number;
    averageRating: number | null;
    activeAgents: number;
    conciergeManaged: number;
  };
  offerBreakdown: { sell: number; rent: number; flats: number; houses: number };
  offers: Array<{
    id: number;
    title: string;
    price: number;
    city: string | null;
    district: string | null;
    rooms?: number | null;
    area?: number | null;
  }>;
  reviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    authorName: string | null;
  }>;
};

type Props = {
  offerId: number;
  offerTitle?: string;
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
};

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

function countBreakdown(offers: Array<{ transactionType?: string | null; propertyType?: string | null }>) {
  let sell = 0;
  let rent = 0;
  let flats = 0;
  let houses = 0;
  for (const o of offers) {
    const tx = String(o.transactionType || "SELL").toUpperCase();
    if (tx === "RENT") rent += 1;
    else sell += 1;
    const pt = String(o.propertyType || "").toUpperCase();
    if (pt === "HOUSE") houses += 1;
    else if (pt === "FLAT" || pt === "APARTMENT") flats += 1;
  }
  return { sell, rent, flats, houses };
}

async function loadAgencyDetail(agency: Agency): Promise<AgencyDetail | null> {
  if (agency.companyId) {
    const res = await fetch(`/api/agency-company/public/id/${agency.companyId}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) {
      const offers = Array.isArray(json.offers) ? json.offers : [];
      const reviews = Array.isArray(json.reviews) ? json.reviews : [];
      return {
        displayName: json.company.name || agency.displayName,
        image: json.company.logoUrl || agency.image,
        address: json.company.address ?? agency.companyAddress ?? null,
        website: json.company.website ?? agency.companyWebsite ?? null,
        phone: json.company.officePhone ?? agency.officePhone ?? null,
        stats: {
          activeListings: json.stats?.activeListings ?? agency.activeListings,
          reviewsCount: json.stats?.reviewsCount ?? agency.reviewsCount,
          averageRating: json.stats?.averageRating ?? agency.averageRating,
          activeAgents: json.stats?.activeAgents ?? agency.memberCount ?? 0,
          conciergeManaged: agency.conciergeManaged ?? 0,
        },
        offerBreakdown: countBreakdown(offers),
        offers: offers.slice(0, 8).map((o: Record<string, unknown>) => ({
          id: Number(o.id),
          title: String(o.title || ""),
          price: Number(o.pricePln ?? o.price) || 0,
          city: typeof o.city === "string" ? o.city : null,
          district: typeof o.district === "string" ? o.district : null,
          rooms: o.rooms != null ? Number(o.rooms) : null,
          area: o.area != null ? Number(o.area) : null,
        })),
        reviews: reviews.slice(0, 6).map((r: Record<string, unknown>) => ({
          id: Number(r.id),
          rating: Number(r.rating) || 0,
          comment: typeof r.comment === "string" ? r.comment : null,
          authorName:
            typeof (r.agent as { name?: string } | undefined)?.name === "string"
              ? (r.agent as { name: string }).name
              : null,
        })),
      };
    }
  }

  const res = await fetch(`/api/users/${agency.id}/public`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.user) return null;
  const offers = Array.isArray(json.offers) ? json.offers : [];
  const reviews = Array.isArray(json.reviews) ? json.reviews : [];
  return {
    displayName: json.user.companyName || json.user.name || agency.displayName,
    image: json.user.image || agency.image,
    address: json.user.companyAddress ?? agency.companyAddress ?? null,
    website: json.user.companyWebsite ?? agency.companyWebsite ?? null,
    phone: json.user.officePhone || json.user.phone || agency.officePhone || null,
    stats: {
      activeListings: offers.filter((o: { status?: string }) => o.status === "ACTIVE").length || agency.activeListings,
      reviewsCount: reviews.length || agency.reviewsCount,
      averageRating:
        reviews.length > 0
          ? Number(
              (reviews.reduce((s: number, r: { rating?: number }) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1),
            )
          : agency.averageRating,
      activeAgents: agency.memberCount ?? 1,
      conciergeManaged: agency.conciergeManaged ?? 0,
    },
    offerBreakdown: countBreakdown(offers),
    offers: offers.slice(0, 8).map((o: Record<string, unknown>) => ({
      id: Number(o.id),
      title: String(o.title || ""),
      price: Number(o.pricePln ?? o.price) || 0,
      city: typeof o.city === "string" ? o.city : null,
      district: typeof o.district === "string" ? o.district : null,
      rooms: o.rooms != null ? Number(o.rooms) : null,
      area: o.area != null ? Number(o.area) : null,
    })),
    reviews: reviews.slice(0, 6).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      rating: Number(r.rating) || 0,
      comment: typeof r.comment === "string" ? r.comment : null,
      authorName: typeof r.reviewerName === "string" ? r.reviewerName : null,
    })),
  };
}

export default function AgencyTransferModal({ offerId, offerTitle, open, onClose, onSent }: Props) {
  const [step, setStep] = useState<1 | 2 | "detail" | 3>(1);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selected, setSelected] = useState<Agency | null>(null);
  const [detail, setDetail] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelected(null);
    setDetail(null);
    setLoading(true);
    fetch("/api/agencje", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAgencies(Array.isArray(d.agencies) ? d.agencies : []))
      .finally(() => setLoading(false));
  }, [open]);

  const requestTransfer = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/concierge/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ offerId, agencyId: selected.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(3);
        onSent?.();
      } else {
        alert(data.error || "Nie udało się wysłać zapytania.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (agency: Agency) => {
    setSelected(agency);
    setDetail(null);
    setStep("detail");
    setDetailLoading(true);
    try {
      setDetail(await loadAgencyDetail(agency));
    } finally {
      setDetailLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 eos-z-modal-nested flex items-start justify-center overflow-y-auto p-4 pt-16">
      <div className="eos-modal-backdrop absolute inset-0" onClick={onClose} />
      <div className="eos-themed-modal relative flex w-full max-w-xl flex-col rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-strong)] sm:max-h-[90vh] sm:p-8">
        <button
          type="button"
          onClick={() => {
            onClose();
            setStep(1);
          }}
          className="absolute right-5 top-5 text-[var(--eos-subtle)] hover:text-[var(--eos-text)]"
        >
          <X className="size-5" />
        </button>

        {step === 3 ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
            <p className="mt-4 text-2xl font-black text-emerald-400">Zapytanie wysłane</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)]">
              Agencja otrzymała powiadomienie i przeanalizuje Twoje ogłoszenie. Gdy prześle warunki
              współpracy, dostaniesz alert — zaakceptujesz je jednym kliknięciem w panelu CRM.
            </p>
            <p className="mt-4 text-xs text-[var(--eos-subtle)]">
              Do tego czasu oferta pozostaje u Ciebie. Nic nie zmienia się bez Twojej zgody.
            </p>
          </div>
        ) : step === 1 ? (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Concierge</p>
            <h3 className="mt-2 text-2xl font-black text-[var(--eos-text)]">Oddaj sprzedaż profesjonalnej agencji</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)]">
              {offerTitle ? `„${offerTitle}”` : `Oferta #${offerId}`} — wybierz biuro, które przejmie
              kontakt z kupującymi i doprowadzi transakcję do końca.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-sm text-[var(--eos-muted)]">
              <p className="flex items-center gap-2 font-bold text-[var(--eos-text)]">
                <Shield className="size-4 text-emerald-400" />
                Co się stanie?
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-emerald-400">1.</span> Wybierasz agencję — wysyłamy im podgląd ogłoszenia.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">2.</span> Biuro proponuje prowizję i zakres usług.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">3.</span> Po Twojej akceptacji agencja przejmuje sprzedaż.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className={eosBtn("home", { block: true, className: "mt-6" })}
            >
              Wybierz agencję <ChevronRight className="size-4" />
            </button>
          </>
        ) : step === "detail" && selected ? (
          <>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)] hover:text-[var(--eos-text)]"
            >
              ← Wróć do listy biur
            </button>
            <h3 className="text-xl font-black text-[var(--eos-text)]">Profil biura</h3>
            <p className="mt-2 text-sm text-[var(--eos-muted)]">Sprawdź doświadczenie i portfolio przed wysłaniem zapytania.</p>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-emerald-500" />
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
                      {getBestUserAvatarUrl({ image: detail.image }) ? (
                        <img src={getBestUserAvatarUrl({ image: detail.image })!} alt="" className="size-full object-cover" />
                      ) : (
                        <Building2 className="size-7 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[var(--eos-text)]">{detail.displayName}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-[var(--eos-muted)]">
                        {detail.stats.averageRating != null ? (
                          <>
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {detail.stats.averageRating} ·
                          </>
                        ) : null}
                        {detail.stats.reviewsCount} opinii
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3 text-center">
                      <p className="text-lg font-black text-[var(--eos-text)]">{detail.stats.activeListings}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Oferty</p>
                    </div>
                    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3 text-center">
                      <p className="text-lg font-black text-[var(--eos-text)]">{detail.stats.activeAgents}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Agenci</p>
                    </div>
                    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3 text-center">
                      <p className="text-lg font-black text-[var(--eos-text)]">{detail.stats.conciergeManaged}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Concierge</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-sm text-[var(--eos-muted)]">
                    <p className="font-bold text-[var(--eos-text)]">Portfolio</p>
                    <p className="mt-2">
                      Sprzedaż: {detail.offerBreakdown.sell} · Wynajem: {detail.offerBreakdown.rent}
                    </p>
                    <p>
                      Mieszkania: {detail.offerBreakdown.flats} · Domy: {detail.offerBreakdown.houses}
                    </p>
                  </div>

                  {(detail.address || detail.phone || detail.website) && (
                    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-sm text-[var(--eos-muted)]">
                      <p className="font-bold text-[var(--eos-text)]">Kontakt</p>
                      {detail.address ? (
                        <p className="mt-2 flex items-start gap-2">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                          {detail.address}
                        </p>
                      ) : null}
                      {detail.phone ? (
                        <p className="mt-2 flex items-center gap-2">
                          <Phone className="size-4 shrink-0 text-emerald-400" />
                          {detail.phone}
                        </p>
                      ) : null}
                      {detail.website ? (
                        <a href={detail.website} target="_blank" rel="noreferrer" className="mt-2 block text-emerald-400">
                          {detail.website}
                        </a>
                      ) : null}
                    </div>
                  )}

                  {detail.reviews.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-[var(--eos-text)]">Opinie klientów</p>
                      {detail.reviews.map((r) => (
                        <div key={r.id} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3">
                          <p className="flex items-center gap-2 text-xs text-[var(--eos-muted)]">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {r.rating}
                            {r.authorName ? ` · ${r.authorName}` : ""}
                          </p>
                          {r.comment ? <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{r.comment}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {detail.offers.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-[var(--eos-text)]">Przykładowe oferty</p>
                      {detail.offers.map((o) => (
                        <div key={o.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[var(--eos-text)]">{o.title}</p>
                            <p className="text-xs text-[var(--eos-subtle)]">
                              {[o.city, o.district].filter(Boolean).join(", ")}
                              {o.rooms ? ` · ${o.rooms} pok.` : ""}
                              {o.area ? ` · ${o.area} m²` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 font-black text-emerald-400">{fmtPrice(o.price)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="py-8 text-sm text-[var(--eos-muted)]">Nie udało się wczytać profilu biura.</p>
              )}
            </div>

            <button
              type="button"
              disabled={submitting || detailLoading || !detail}
              onClick={() => void requestTransfer()}
              className={eosBtn("home", { block: true, className: "mt-4" })}
            >
              {submitting ? <Loader2 className="size-5 animate-spin" /> : "Wyślij zapytanie do tego biura"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)] hover:text-[var(--eos-text)]"
            >
              ← Wróć do wyjaśnienia
            </button>
            <h3 className="text-xl font-black text-[var(--eos-text)]">Wybierz biuro</h3>
            <p className="mt-2 text-sm text-[var(--eos-muted)]">Dotknij biuro, aby zobaczyć szczegóły przed wysłaniem zapytania.</p>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-6 animate-spin text-emerald-500" />
              </div>
            ) : (
              <div className="mt-6 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {agencies.map((a) => {
                  const avatar = getBestUserAvatarUrl({ image: a.image });
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => void openDetail(a)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-left transition hover:border-emerald-500/40"
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black">
                        {avatar ? (
                          <img src={avatar} alt="" className="size-full object-cover" />
                        ) : (
                          <Building2 className="size-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-[var(--eos-text)]">{a.displayName}</p>
                        <p className="text-[10px] text-[var(--eos-subtle)]">
                          {a.averageRating != null ? `${a.averageRating} ★ · ` : ""}
                          {a.reviewsCount} opinii · {a.activeListings} ofert
                        </p>
                        {a.conciergeManaged ? (
                          <p className="text-[10px] font-bold text-emerald-400">{a.conciergeManaged} przekazań Concierge</p>
                        ) : null}
                      </div>
                      <ChevronRight className="size-4 text-[var(--eos-subtle)]" />
                    </button>
                  );
                })}
              </div>
            )}
            <Link
              href="/agencje"
              className="mt-4 block text-center text-[10px] font-black uppercase tracking-widest text-emerald-500"
            >
              Pełny katalog agencji
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
