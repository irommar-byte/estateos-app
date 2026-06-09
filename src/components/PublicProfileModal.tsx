"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Star,
  Briefcase,
  CalendarCheck,
  AlertCircle,
  Home,
  Eye,
  User,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import Link from "next/link";
import EliteStatusBadges from "@/components/ui/EliteStatusBadges";
import ProfileWriteMessageButton from "@/components/contact/ProfileWriteMessageButton";
import { buildReviewsDistribution } from "@/lib/reviewsDistribution";
import { getBestUserAvatarUrl, isAgencyUser, resolveAgencyDisplayName } from "@/lib/userAvatar";
import { useLocale } from "@/contexts/LocaleContext";
import {
  getPresentationFlowDictionary,
  fmtPresentation,
} from "@/i18n/presentationFlowDictionary";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";

export default function PublicProfileModal({
  isOpen,
  onClose,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}) {
  const { locale } = useLocale();
  const t = getPresentationFlowDictionary(locale);
  const p = t.profile;

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDistribution, setShowDistribution] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(userId);
  const [profileStack, setProfileStack] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    void fetch("/api/user/profile", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const id = Number(data?.id ?? data?.user?.id);
        setCurrentUserId(res.ok && Number.isFinite(id) && id > 0 ? id : null);
      })
      .catch(() => setCurrentUserId(null));
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      setViewUserId(userId);
      setProfileStack([]);
      setShowDistribution(false);
    } else if (!isOpen) {
      setViewUserId(null);
      setProfileStack([]);
      setData(null);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen && viewUserId) {
      setLoading(true);
      setShowDistribution(false);
      fetch(`/api/users/${viewUserId}/public`, { cache: "no-store" })
        .then(async (res) => {
          const d = await res.json();
          if (res.ok && d?.user) setData(d);
          else setData(null);
        })
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else if (!viewUserId) {
      setData(null);
    }
  }, [isOpen, viewUserId]);

  const openReviewerProfile = (reviewerId: number | string | null | undefined) => {
    const nextId = String(reviewerId ?? "").trim();
    if (!nextId || nextId === viewUserId) return;
    setProfileStack((prev) => (viewUserId ? [...prev, viewUserId] : prev));
    setViewUserId(nextId);
  };

  const goBackProfile = () => {
    setProfileStack((prev) => {
      const stack = [...prev];
      const previousId = stack.pop();
      if (previousId) setViewUserId(previousId);
      return stack;
    });
  };

  const handleClose = () => {
    setProfileStack([]);
    setViewUserId(null);
    onClose();
  };

  if (!mounted || !isOpen) return null;

  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const { averageRating, totalReviews, distribution } = buildReviewsDistribution(reviews);
  const avatarUrl = getBestUserAvatarUrl(data?.user);
  const agencyName = isAgencyUser(data?.user) ? resolveAgencyDisplayName(data?.user) : null;

  const pres = data?.stats?.presentations ?? {
    held: data?.stats?.completed ?? 0,
    noShow: data?.stats?.noShow ?? 0,
    scheduled: (data?.stats?.completed ?? 0) + (data?.stats?.noShow ?? 0),
  };

  const modalContent = (
    <div className="theme-aware-dashboard fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="eos-modal-backdrop absolute inset-0"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="eos-modal-surface relative w-full max-w-lg max-h-[90vh] my-auto shrink-0 overflow-hidden flex flex-col rounded-[2rem] text-[var(--eos-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />

        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 z-20 w-9 h-9 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] flex items-center justify-center text-[var(--eos-muted)] hover:text-[var(--eos-text)] transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="px-5 pt-5 pb-2 border-b border-[var(--eos-border)] relative z-10">
          <div className="flex items-center gap-2 pr-10">
            {profileStack.length > 0 ? (
              <button
                type="button"
                onClick={goBackProfile}
                className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-500 transition-colors shrink-0"
              >
                ← {p.backToProfile}
              </button>
            ) : (
              <h3 className="text-lg font-black tracking-tight">{p.title}</h3>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{p.loading}</p>
          </div>
        ) : data ? (
          <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 relative z-10 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[var(--eos-border)] bg-[var(--eos-bg)] shrink-0 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : agencyName ? (
                  <Briefcase size={28} className="text-blue-400" />
                ) : (
                  <User size={28} className="text-[var(--eos-subtle)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black tracking-tight leading-tight truncate">
                  {agencyName || data.user.displayName || data.user.publicName || data.user.name}
                </h3>
                {agencyName && data.user.name ? (
                  <p className="text-sm font-medium text-[var(--eos-muted)] mt-0.5 truncate">{data.user.name}</p>
                ) : null}
                <EliteStatusBadges subject={data.user} compact className="mt-1.5" />
                <p className="text-[11px] text-[var(--eos-muted)] mt-1">ID: {data.user.id}</p>
              </div>
            </div>

            {viewUserId && Number(viewUserId) !== currentUserId ? (
              <div className="flex justify-center">
                <ProfileWriteMessageButton
                  peerUserId={Number(viewUserId)}
                  peerName={agencyName || data.user.displayName || data.user.publicName || data.user.name || undefined}
                  currentUserId={currentUserId}
                  variant="light"
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowDistribution((v) => !v)}
              className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-4 text-left hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`text-4xl font-black shrink-0 ${totalReviews > 0 ? "text-amber-500" : "text-[var(--eos-subtle)]"}`}
                >
                  {totalReviews > 0 ? averageRating.toFixed(1) : "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          totalReviews > 0 && i <= Math.round(averageRating)
                            ? "text-amber-500 fill-amber-500"
                            : "text-[var(--eos-border)]"
                        }
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[var(--eos-muted)] uppercase tracking-widest">
                      {totalReviews > 0 ? fmtPresentation(p.reviewsCount, { n: totalReviews }) : p.reviewsNone}
                    </span>
                    {showDistribution ? (
                      <ChevronUp size={14} className="text-[var(--eos-muted)]" />
                    ) : (
                      <ChevronDown size={14} className="text-[var(--eos-muted)]" />
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showDistribution ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 mt-4 pt-3 border-t border-[var(--eos-border)]">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = distribution[stars as 1 | 2 | 3 | 4 | 5] || 0;
                        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--eos-muted)] w-3">{stars}</span>
                            <Star size={10} className="text-[var(--eos-subtle)] fill-[var(--eos-subtle)] shrink-0" />
                            <div className="flex-1 h-1.5 bg-[var(--eos-border)] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                className="h-full bg-amber-500 rounded-full"
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--eos-subtle)] w-4 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </button>

            <div>
              <h4 className="text-[10px] font-black text-[var(--eos-subtle)] uppercase tracking-[0.2em] mb-1 text-center">
                {p.presentationHistory}
              </h4>
              {pres.scheduled > 0 ? (
                <p className="text-[9px] text-center text-[var(--eos-muted)] mb-3">
                  {fmtPresentation(p.scheduledOf, { n: pres.scheduled })}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-col items-center text-center"
                  title={p.heldHint}
                >
                  <CalendarCheck size={22} className="text-emerald-500 mb-2" />
                  <span className="text-2xl font-black">{pres.held}</span>
                  <span className="text-[8px] font-bold text-[var(--eos-muted)] uppercase tracking-widest mt-1">{p.held}</span>
                  <p className="text-[8px] text-[var(--eos-subtle)] mt-2 leading-snug flex items-start gap-1">
                    <Info size={10} className="shrink-0 mt-0.5" />
                    {p.heldHint}
                  </p>
                </div>
                <div
                  className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 flex flex-col items-center text-center"
                  title={p.noShowHint}
                >
                  <AlertCircle size={22} className="text-red-500 mb-2" />
                  <span className="text-2xl font-black">{pres.noShow}</span>
                  <span className="text-[8px] font-bold text-[var(--eos-muted)] uppercase tracking-widest mt-1">{p.noShow}</span>
                  <p className="text-[8px] text-[var(--eos-subtle)] mt-2 leading-snug flex items-start gap-1">
                    <Info size={10} className="shrink-0 mt-0.5" />
                    {p.noShowHint}
                  </p>
                </div>
              </div>
            </div>

            {data.offers.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black text-[var(--eos-subtle)] uppercase tracking-[0.2em] mb-3 text-center">
                  {fmtPresentation(p.otherOffers, { n: data.offers.length })}
                </h4>
                <div className="flex flex-col gap-2">
                  {data.offers.map((o: any) => {
                    const thumb = o.imageUrl || resolveOfferPrimaryImage(o);
                    return (
                    <Link
                      key={o.id}
                      href={`/oferta/${o.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] hover:border-emerald-500/30 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden relative shrink-0 bg-[var(--eos-bg-elevated)]">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        {!thumb ? (
                          <Home className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--eos-subtle)]" size={20} />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold truncate">{o.title || `ID ${o.id}`}</h5>
                        <p className="text-[10px] text-[var(--eos-muted)] truncate">{o.district || o.city || "—"}</p>
                      </div>
                      <Eye size={14} className="text-emerald-500/70 shrink-0" />
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {reviews.length > 0 ? (
              <div>
                <h4 className="text-[10px] font-black text-[var(--eos-subtle)] uppercase tracking-[0.2em] mb-3 text-center">
                  {p.reviewsSection}
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {reviews.slice(0, 8).map((r: any) => {
                    const reviewerLabel =
                      String(r.reviewerName ?? "").trim() ||
                      fmtPresentation(p.reviewerFallback, { id: r.reviewerId ?? "?" });
                    const canOpenReviewer = Boolean(r.reviewerId);
                    return (
                    <div key={r.id} className="p-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]">
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          {canOpenReviewer ? (
                            <button
                              type="button"
                              onClick={() => openReviewerProfile(r.reviewerId)}
                              className="text-xs font-bold text-[var(--eos-text)] hover:text-emerald-600 transition-colors text-left truncate block max-w-full mb-1"
                            >
                              {reviewerLabel}
                            </button>
                          ) : (
                            <p className="text-xs font-bold text-[var(--eos-text)] mb-1 truncate">{reviewerLabel}</p>
                          )}
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                size={10}
                                className={i <= r.rating ? "text-amber-500 fill-amber-500" : "text-[var(--eos-border)]"}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[8px] text-[var(--eos-subtle)] uppercase tracking-widest shrink-0">
                          {new Date(r.createdAt).toLocaleDateString(
                          locale === "en" ? "en-GB" : locale === "uk" ? "uk-UA" : "pl-PL"
                        )}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--eos-muted)] leading-relaxed">{r.comment || p.reviewNoComment}</p>
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-[var(--eos-muted)]">{p.noReviewsUser}</p>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-[var(--eos-muted)]">{p.loadError}</div>
        )}
      </motion.div>
    </div>
  );

  return createPortal(<AnimatePresence>{isOpen && modalContent}</AnimatePresence>, document.body);
}
