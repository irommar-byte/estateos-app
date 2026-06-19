"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ticket, ShoppingBag, Sparkles, Gift, CheckCircle2 } from "lucide-react";
import { PAKIET_PLUS_PRICE_LABEL, PUBLICATION_DURATION_DAYS, PUBLICATION_RENEWAL_PRICE_LABEL } from "@/lib/publicationConstants";
import type { PublicationSelection } from "@/lib/publicationSelection";
import { defaultPublicationSelection } from "@/lib/publicationSelection";
import { useLocale } from "@/contexts/LocaleContext";

type WalletCoupon = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  pillLabel?: string;
  meta?: string;
};

type WalletData = {
  plusCredits: number;
  plusExpiresAt: string | null;
  hasPlusCredit: boolean;
  coupons: WalletCoupon[];
  couponCount: number;
};

type WalletOverride = {
  coupons: WalletCoupon[];
  plusCredits: number;
  hasPlusCredit: boolean;
  plusExpiresAt?: string | null;
};

type Props = {
  onBuyPlus?: () => void;
  buyingPlus?: boolean;
  /** Wybór metody publikacji na ekranie podsumowania (jak w aplikacji). */
  selectable?: boolean;
  selection?: PublicationSelection;
  onSelectionChange?: (selection: PublicationSelection) => void;
  /** Gdy podane — panel nie robi własnego fetchu (synchronizacja z formularzem). */
  walletOverride?: WalletOverride | null;
  /** `renew` — płatność za odnowienie konkretnej oferty zamiast zakupu Pakietu Plus. */
  variant?: "publish" | "renew";
};

function SelectRing({ active }: { active: boolean }) {
  return (
    <div
      className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all ${
        active ? "border-emerald-400 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.55)]" : "border-white/25 bg-transparent"
      }`}
    >
      {active ? <CheckCircle2 size={14} className="m-[1px] text-black" /> : null}
    </div>
  );
}

export default function PublicationWalletPanel({
  onBuyPlus,
  buyingPlus,
  selectable = false,
  selection,
  onSelectionChange,
  walletOverride,
  variant = "publish",
}: Props) {
  const { dict, locale } = useLocale();
  const ao = dict.addOffer;
  const dateLocale = locale === "uk" ? "uk-UA" : locale === "en" ? "en-GB" : "pl-PL";

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(!walletOverride);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (walletOverride) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/user/publication-wallet?locale=${locale}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          setWallet(data);
        } else {
          setWallet(null);
          setLoadError(String(data?.error || data?.message || ao.walletLoadFailed));
        }
      } else {
        setWallet(null);
        setLoadError(ao.walletHttpError);
      }
    } finally {
      setLoading(false);
    }
  }, [walletOverride, locale, ao.walletLoadFailed, ao.walletHttpError]);

  useEffect(() => {
    if (walletOverride) {
      setWallet({
        plusCredits: walletOverride.plusCredits,
        plusExpiresAt: walletOverride.plusExpiresAt ?? null,
        hasPlusCredit: walletOverride.hasPlusCredit,
        coupons: walletOverride.coupons,
        couponCount: walletOverride.coupons.length,
      });
      setLoading(false);
      setLoadError(null);
      return;
    }
    load();
  }, [load, walletOverride]);

  const coupons = wallet?.coupons ?? [];
  const hasPlusCredit = Boolean(wallet?.hasPlusCredit);
  const plusCredits = Number(wallet?.plusCredits || 0);

  const expiryLabel =
    wallet?.plusExpiresAt && wallet.hasPlusCredit
      ? new Date(wallet.plusExpiresAt).toLocaleDateString(dateLocale)
      : null;

  const resolvedSelection = useMemo((): PublicationSelection => {
    if (selection) return selection;
    return defaultPublicationSelection({
      couponIds: coupons.map((c) => c.id),
      hasPlusCredit,
    });
  }, [selection, coupons, hasPlusCredit]);

  const pick = (next: PublicationSelection) => {
    onSelectionChange?.(next);
  };

  if (!selectable) {
    return (
      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <Ticket className="text-orange-400" size={20} />
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{ao.walletBonusCoupons}</h3>
              <p className="mt-1 text-[10px] text-white/40">
                {loading
                  ? "…"
                  : ao.walletActiveCouponsCount.replace("{count}", String(wallet?.couponCount ?? 0))}
              </p>
            </div>
          </div>
          {loadError ? (
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-xs text-red-200/90">
              {loadError}
            </p>
          ) : coupons.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-6 text-center text-xs text-white/35">
              {ao.walletNoCoupons}
            </p>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-[#111] p-5 text-xs text-white/50">
              {coupons[0]?.title}
            </p>
          )}
        </div>
        <div className="rounded-[2rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-transparent p-6 shadow-xl">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/35">{ao.walletPlusPackage}</p>
          <p className="text-sm font-bold text-emerald-400">
            {hasPlusCredit
              ? ao.walletPlusCreditsAvailable.replace("{count}", String(plusCredits))
              : ao.walletNoPlusCredit}
          </p>
          {expiryLabel ? (
            <p className="mt-1 text-xs text-white/45">
              {ao.walletValidUntil.replace("{date}", expiryLabel)}
            </p>
          ) : null}
          <button
            type="button"
            disabled={buyingPlus}
            onClick={onBuyPlus}
            className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-left transition-all hover:border-emerald-400/50 disabled:opacity-60"
          >
            <ShoppingBag size={18} className="text-emerald-400" />
            <span className="text-sm font-bold text-white">{ao.walletBuyPlus}</span>
          </button>
        </div>
      </div>
    );
  }

  const isRenew = variant === "renew";
  const paySelection: PublicationSelection = isRenew ? "pay_renewal" : "buy_plus";
  const plusCreditExpirySuffix = expiryLabel
    ? ` · ${ao.walletValidUntil.replace("{date}", expiryLabel)}`
    : "";

  return (
    <div className="mb-8">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
          {isRenew ? ao.walletRenewMethod : ao.walletPublishMethod}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {isRenew ? ao.walletRenewHint : ao.walletPublishHint}
        </p>
      </div>

      {loadError ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-xs text-red-200/90">
          {loadError}
        </p>
      ) : (
        <div className="space-y-6">
          {coupons.length > 0 && (
            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
                <Ticket size={14} /> {ao.walletBonusCoupons}
              </p>
              <div className="space-y-2">
                {coupons.map((coupon) => {
                  const active = resolvedSelection === `coupon:${coupon.id}`;
                  return (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => pick(`coupon:${coupon.id}`)}
                      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                        active
                          ? "border-orange-400/60 bg-orange-500/10 shadow-[0_0_24px_rgba(251,146,60,0.12)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                        <Gift size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white">{coupon.title}</p>
                          {coupon.pillLabel ? (
                            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-300">
                              {coupon.pillLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-white/50">{coupon.subtitle}</p>
                        {coupon.meta ? (
                          <p className="mt-1 text-[10px] font-medium text-emerald-400/85">{coupon.meta}</p>
                        ) : null}
                      </div>
                      <SelectRing active={active} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              <Sparkles size={14} /> {ao.walletPlusPackage}
            </p>
            <div className="space-y-2">
              {hasPlusCredit ? (
                <button
                  type="button"
                  onClick={() => pick("plus_credit")}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                    resolvedSelection === "plus_credit"
                      ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                    <span className="text-xl font-black text-emerald-400 tabular-nums">{plusCredits}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70">Plus</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{ao.walletUsePlusCredit}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {ao.walletPlusCreditLine
                        .replace("{count}", String(plusCredits))
                        .replace("{days}", String(PUBLICATION_DURATION_DAYS))
                        .replace("{expiry}", plusCreditExpirySuffix)}
                    </p>
                  </div>
                  <SelectRing active={resolvedSelection === "plus_credit"} />
                </button>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 bg-black/25 px-4 py-3 text-xs text-white/40">
                  {ao.walletNoPlusOnAccount}
                </p>
              )}

              <button
                type="button"
                onClick={() => pick(paySelection)}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                  resolvedSelection === paySelection
                    ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <ShoppingBag size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">
                    {isRenew ? ao.walletPayRenewal : ao.walletBuyPlusAction}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {isRenew
                      ? ao.walletRenewPaymentDesc
                          .replace("{days}", String(PUBLICATION_DURATION_DAYS))
                          .replace("{price}", PUBLICATION_RENEWAL_PRICE_LABEL)
                      : ao.walletBuyPlusPaymentDesc.replace("{price}", PAKIET_PLUS_PRICE_LABEL)}
                  </p>
                </div>
                <SelectRing active={resolvedSelection === paySelection} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
