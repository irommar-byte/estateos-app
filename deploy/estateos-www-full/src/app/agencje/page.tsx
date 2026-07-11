"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Star,
  MapPin,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Briefcase,
  X,
  Globe,
  Phone,
  Mail,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { getAgencjeCatalogDictionary } from "@/i18n/agencjeCatalogDictionary";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";

type AgencyCard = {
  id: number;
  companyId?: number;
  slug?: string | null;
  displayName: string;
  companyName: string | null;
  name: string | null;
  image: string | null;
  activeListings: number;
  reviewsCount: number;
  averageRating: number | null;
  companyAddress: string | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
};

type DetailTab = "offers" | "reviews";

type AgencyOfferRow = {
  id: number;
  title: string;
  price: number;
  pricePln?: number | null;
  city: string;
  district: string | null;
  status?: string;
  images?: unknown;
};

type AgencyReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName?: string | null;
  agentName?: string | null;
};

type AgencyDetail = {
  displayName: string;
  profileId: number;
  firmHref: string;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
  averageRating: number | null;
  offers: AgencyOfferRow[];
  reviews: AgencyReviewRow[];
};

function formatPrice(offer: AgencyOfferRow) {
  const amount = offer.pricePln ?? offer.price;
  return `${Math.round(amount).toLocaleString("pl-PL")} zł`;
}

function mapCompanyPublicDetail(
  json: {
    company: {
      name: string;
      slug?: string | null;
      address: string | null;
      website: string | null;
      logoUrl: string | null;
      officePhone: string | null;
      officeEmail: string | null;
    };
    stats: { averageRating: number | null };
    offers?: AgencyOfferRow[];
    reviews?: Array<{
      id: number;
      rating: number;
      comment: string | null;
      createdAt: string;
      agent?: { name: string | null };
    }>;
  },
  agency: AgencyCard,
): AgencyDetail {
  const firmHref = json.company.slug ? `/firma/${json.company.slug}` : `/profil/${agency.id}`;

  return {
    displayName: json.company.name,
    profileId: agency.id,
    firmHref,
    address: json.company.address,
    website: json.company.website,
    logoUrl: json.company.logoUrl,
    officePhone: json.company.officePhone,
    officeEmail: json.company.officeEmail,
    averageRating: json.stats.averageRating,
    offers: (json.offers || []).map((o) => ({
      id: o.id,
      title: o.title,
      price: o.price,
      pricePln: o.pricePln,
      city: o.city,
      district: o.district,
      images: o.images,
    })),
    reviews: (json.reviews || []).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      agentName: r.agent?.name ?? null,
    })),
  };
}

async function fetchCompanyPublicDetail(agency: AgencyCard): Promise<AgencyDetail | null> {
  const urls: string[] = [];
  if (agency.slug) {
    urls.push(`/api/agency-company/public/${encodeURIComponent(agency.slug)}`);
  }
  if (agency.companyId) {
    urls.push(`/api/agency-company/public/id/${agency.companyId}`);
  }

  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) {
      return mapCompanyPublicDetail(json, agency);
    }
  }

  return null;
}

async function fetchAgencyDetail(agency: AgencyCard): Promise<AgencyDetail | null> {
  const firmHref = agency.slug ? `/firma/${agency.slug}` : `/profil/${agency.id}`;

  if (agency.slug || agency.companyId) {
    const companyDetail = await fetchCompanyPublicDetail(agency);
    if (companyDetail) return companyDetail;
    if (agency.companyId) return null;
  }

  const res = await fetch(`/api/users/${agency.id}/public`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) return null;

  const reviews = Array.isArray(json.reviews) ? json.reviews : [];
  const avg =
    reviews.length > 0
      ? Number((reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length).toFixed(1))
      : null;

  return {
    displayName: json.user.companyName || json.user.name || agency.displayName,
    profileId: json.user.id,
    firmHref,
    address: json.user.companyAddress,
    website: json.user.companyWebsite,
    logoUrl: json.user.companyLogoUrl || json.user.image,
    officePhone: json.user.officePhone || json.user.phone,
    officeEmail: json.user.officeEmail,
    averageRating: avg,
    offers: (json.offers || []).map((o: AgencyOfferRow & { imageUrl?: string | null }) => ({
      id: o.id,
      title: o.title,
      price: o.price,
      pricePln: o.pricePln,
      city: o.city,
      district: o.district,
      images: o.images ?? (o.imageUrl ? [o.imageUrl] : undefined),
    })),
    reviews: reviews.map((r: { id: number; rating: number; comment: string | null; createdAt: string | Date; reviewerName?: string }) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
      reviewerName: r.reviewerName,
    })),
  };
}

export default function AgencjePage() {
  const { locale } = useLocale();
  const d = getAgencjeCatalogDictionary(locale);
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AgencyDetail | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("offers");
  const [detailTitle, setDetailTitle] = useState("");

  const openAgencyDetail = async (agency: AgencyCard, tab: DetailTab) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailTab(tab);
    setDetailTitle(agency.displayName);
    try {
      const payload = await fetchAgencyDetail(agency);
      if (payload) setDetail(payload);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/agencje", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAgencies(Array.isArray(d.agencies) ? d.agencies : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pb-32 pt-28 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-emerald-500/10 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-500">
          EstateOS™ · biura partnerskie
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tighter sm:text-5xl">
          {d.title} <span className="text-emerald-500">{d.titleAccent}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
          Zweryfikowane biura nieruchomości z opiniami, aktywnymi ofertami i pełnym wsparciem w CRM.
          Kliknij gwiazdki, aby zobaczyć opinie, lub liczbę ofert, aby przejrzeć portfolio biura.
        </p>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="size-8 animate-spin text-emerald-500" />
          </div>
        ) : agencies.length === 0 ? (
          <p className="mt-16 text-center text-[var(--eos-muted)]">{d.empty}</p>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.map((agency, i) => {
              const avatar = getBestUserAvatarUrl({ image: agency.companyLogoUrl || agency.image });
              const ratingValue = agency.averageRating ?? 0;
              const firmHref = agency.slug ? `/firma/${agency.slug}` : `/profil/${agency.id}`;
              const hasReviews = agency.reviewsCount > 0 && agency.averageRating != null;

              return (
                <motion.article
                  key={`${agency.id}-${agency.slug || "legacy"}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex flex-col rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-6 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl transition hover:border-emerald-500/30"
                >
                  <div className="flex items-start gap-4">
                    <Link
                      href={firmHref}
                      className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] transition hover:border-emerald-500/40"
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="size-full object-cover" />
                      ) : (
                        <Building2 className="size-6 text-emerald-500/70" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={firmHref} className="block truncate text-lg font-bold hover:text-emerald-500">
                        {agency.displayName}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void openAgencyDetail(agency, "reviews")}
                        className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-1 py-0.5 text-xs text-amber-400 transition hover:bg-amber-500/10 hover:underline"
                        aria-label={`Zobacz opinie: ${agency.displayName}`}
                      >
                        {[0, 1, 2, 3, 4].map((idx) => (
                          <Star
                            key={idx}
                            className={`size-3.5 ${ratingValue >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-[var(--eos-border)]"}`}
                          />
                        ))}
                        <span className="font-semibold">
                          {hasReviews
                            ? `${agency.averageRating} · ${agency.reviewsCount} opinii`
                            : d.reviewsCta}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                    <button
                      type="button"
                      onClick={() => void openAgencyDetail(agency, "offers")}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--eos-input)] px-3 py-1.5 transition hover:bg-emerald-500/15 hover:text-emerald-600"
                      aria-label={`{d.offersCta}: ${agency.displayName}`}
                    >
                      <Briefcase className="size-3" />
                      {agency.activeListings} ofert
                    </button>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-500">
                      <ShieldCheck className="size-3" />
                      Partner
                    </span>
                  </div>

                  <Link
                    href={firmHref}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--eos-text)] py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-bg)] transition group-hover:bg-emerald-500 group-hover:text-black"
                  >
                    {agency.slug ? "Strona biura" : "Zobacz profil"}
                    <ChevronRight className="size-3.5" />
                  </Link>
                </motion.article>
              );
            })}
          </div>
        )}

        <div className="mt-16 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <MapPin className="mx-auto mb-3 size-8 text-emerald-500" />
          <p className="text-lg font-bold">{d.ctaJoinTitle}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--eos-muted)]">
            W panelu „Moje ogłoszenia” wybierz ofertę i kliknij „Oddaj do agencji” — przejrzysz warunki i zachowasz
            podgląd bez obowiązku odbierania telefonów.
          </p>
          <Link
            href="/moje-konto/crm?tab=my_offers"
            className="mt-6 inline-flex rounded-full bg-emerald-500 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-black"
          >
            Przejdź do moich ogłoszeń
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {detailOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setDetailOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl sm:rounded-[1.75rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--eos-border)] p-5 sm:p-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{d.detailEyebrow}</p>
                  <h3 className="truncate text-xl font-black">{detail?.displayName || detailTitle}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="shrink-0 rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
                  aria-label={d.close}
                >
                  <X className="size-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex flex-1 items-center justify-center py-20">
                  <Loader2 className="size-8 animate-spin text-emerald-500" />
                </div>
              ) : !detail ? (
                <div className="py-16 text-center text-sm text-[var(--eos-muted)]">{d.loadError}</div>
              ) : (
                <>
                  <div className="grid gap-3 border-b border-[var(--eos-border)] p-5 sm:grid-cols-2 sm:p-6">
                    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                      {detail.address ? <p className="text-sm text-[var(--eos-muted)]">{detail.address}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {detail.website ? (
                          <a href={detail.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 hover:border-emerald-500/40">
                            <Globe className="size-3" /> WWW
                          </a>
                        ) : null}
                        {detail.officePhone ? (
                          <a href={`tel:${detail.officePhone}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 hover:border-emerald-500/40">
                            <Phone className="size-3" /> Biuro
                          </a>
                        ) : null}
                        {detail.officeEmail ? (
                          <a href={`mailto:${detail.officeEmail}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 hover:border-emerald-500/40">
                            <Mail className="size-3" /> E-mail
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col justify-between rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">{d.ratingLabel}</p>
                        <div className="mt-2 flex items-center gap-1 text-amber-400">
                          {[0, 1, 2, 3, 4].map((idx) => (
                            <Star
                              key={idx}
                              className={`size-4 ${(detail.averageRating ?? 0) >= idx + 1 ? "fill-amber-400" : "text-[var(--eos-border)]"}`}
                            />
                          ))}
                          <span className="ml-2 text-sm font-bold text-[var(--eos-text)]">
                            {detail.averageRating != null ? detail.averageRating.toFixed(1) : "—"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--eos-muted)]">{detail.reviews.length} opinii · {detail.offers.length} ofert</p>
                      </div>
                      <Link
                        href={detail.firmHref}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-500 hover:underline"
                      >
                        Pełna strona biura <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex gap-1 border-b border-[var(--eos-border)] px-5 sm:px-6">
                    {(
                      [
                        { id: "offers" as const, label: `Oferty (${detail.offers.length})`, icon: Briefcase },
                        { id: "reviews" as const, label: `Opinie (${detail.reviews.length})`, icon: MessageSquare },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition ${
                          detailTab === tab.id
                            ? "border-emerald-500 text-emerald-500"
                            : "border-transparent text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                        }`}
                      >
                        <tab.icon className="size-3.5" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                    {detailTab === "offers" ? (
                      detail.offers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-[var(--eos-muted)]">{d.noOffers}</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {detail.offers.map((offer) => {
                            const thumb = resolveOfferPrimaryImage(offer);
                            return (
                              <Link
                                key={offer.id}
                                href={`/oferta/${offer.id}`}
                                className="group overflow-hidden rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/30 transition hover:border-emerald-500/40"
                              >
                                <div className="aspect-[16/10] overflow-hidden bg-[var(--eos-input)]">
                                  {thumb ? (
                                    <img src={thumb} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" />
                                  ) : (
                                    <div className="flex size-full items-center justify-center">
                                      <Briefcase className="size-6 text-[var(--eos-muted)]" />
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <p className="font-bold text-emerald-500">{formatPrice(offer)}</p>
                                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{offer.title}</p>
                                  <p className="mt-1 text-xs text-[var(--eos-muted)]">
                                    {offer.city}
                                    {offer.district ? ` · ${offer.district}` : ""}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )
                    ) : detail.reviews.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[var(--eos-muted)]">{d.noReviews}</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.reviews.map((review) => (
                          <div key={review.id} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/30 p-4">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[0, 1, 2, 3, 4].map((idx) => (
                                  <Star
                                    key={idx}
                                    className={`size-3.5 ${review.rating >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-[var(--eos-border)]"}`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-[var(--eos-muted)]">
                                {review.reviewerName ? review.reviewerName : "Klient"}
                                {review.agentName ? ` · agent: ${review.agentName}` : ""}
                                {" · "}
                                {new Date(review.createdAt).toLocaleDateString("pl-PL")}
                              </span>
                            </div>
                            {review.comment ? (
                              <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{review.comment}</p>
                            ) : (
                              <p className="text-xs italic text-[var(--eos-subtle)]">{d.noComment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
