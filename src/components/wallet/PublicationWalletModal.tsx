"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Minus, Plus } from "lucide-react";
import { PAKIET_PLUS_STRIPE_AMOUNT } from "@/lib/publicationConstants";
import { VaultHero, VaultModal, VaultNotice, VaultSection } from "@/components/wallet/Vault";

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
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const UNIT_PLN = PAKIET_PLUS_STRIPE_AMOUNT / 100;
const MAX_QTY = 20;

function creditsWord(n: number) {
  if (n === 1) return "kredyt";
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? "kredyty" : "kredytów";
}

/** Złota moneta: saldo kredytów publikacji, kupony i dokupienie kredytów. */
export default function PublicationWalletModal({ isOpen, onClose }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [qty, setQty] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/publication-wallet?locale=pl", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setWallet(null);
        setError(String(data?.error || data?.message || "Nie udało się załadować portfela."));
        return;
      }
      setWallet({
        plusCredits: Number(data.plusCredits || 0),
        plusExpiresAt: data.plusExpiresAt ? String(data.plusExpiresAt) : null,
        hasPlusCredit: Boolean(data.hasPlusCredit),
        coupons: Array.isArray(data.coupons) ? data.coupons : [],
      });
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const checkout = async () => {
    setBuying(true);
    setError(null);
    try {
      const base = `${window.location.origin}${window.location.pathname}`;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: "pakiet_plus", credits: qty, returnUrl: `${base}?plus=success`, cancelUrl: `${base}?plus=cancel` }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) throw new Error(String(body?.error || "Nie udało się uruchomić płatności."));
      window.location.href = String(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd płatności.");
      setBuying(false);
    }
  };

  const credits = wallet?.plusCredits ?? 0;
  const coupons = wallet?.coupons ?? [];
  const expiry = wallet?.plusExpiresAt ? new Date(wallet.plusExpiresAt) : null;
  const active = Boolean(expiry && expiry.getTime() > Date.now());
  const expiryLabel = expiry ? expiry.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : null;
  const status = !wallet
    ? null
    : credits === 0
      ? { tone: "warn" as const, text: "Brak kredytów" }
      : active
        ? { tone: "ok" as const, text: "Aktywne" }
        : { tone: "bad" as const, text: "Zamrożone" };

  return (
    <VaultModal open={isOpen} onClose={onClose} variant="gold" label="Kredyty publikacji">
      <VaultHero
        variant="gold"
        kicker="Portfel EOS · kredyty publikacji"
        balance={wallet ? credits : null}
        loading={loading && !wallet}
        unit={`${creditsWord(credits)} do wykorzystania`}
        status={status}
        alert={Boolean(wallet) && credits > 0 && credits <= 1}
        onClose={onClose}
      >
        {credits > 0 && expiryLabel
          ? active
            ? `Ważne do ${expiryLabel}. 1 kredyt = publikacja jednego ogłoszenia.`
            : `Ważność minęła ${expiryLabel} — kredyty wrócą do użytku po przedłużeniu pakietu.`
          : "1 kredyt = publikacja jednego ogłoszenia na rynku EstateOS™."}
      </VaultHero>

      <div className="vault-body">
        {error ? <VaultNotice tone="bad">{error}</VaultNotice> : null}

        <VaultSection title="Dokup kredyty">
          <div className="vault-buy">
            <div className="vault-buy__row">
              <span>
                <span className="block text-[13.5px] font-bold">Kredyty publikacji</span>
                <span className="vault-note">{UNIT_PLN} zł za kredyt</span>
              </span>
              <span className="vault-stepper" aria-label="Liczba kredytów">
                <button type="button" className="vault-step" aria-label="Mniej" disabled={qty <= 1 || buying} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus size={15} />
                </button>
                <span className="vault-stepper__value" aria-live="polite">{qty}</span>
                <button type="button" className="vault-step" aria-label="Więcej" disabled={qty >= MAX_QTY || buying} onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}>
                  <Plus size={15} />
                </button>
              </span>
            </div>
            <button type="button" className="vault-btn" disabled={buying} onClick={() => void checkout()}>
              {buying ? <Loader2 size={16} className="animate-spin" /> : null}
              Kup {qty} {creditsWord(qty)} · <b>{qty * UNIT_PLN} zł</b>
            </button>
          </div>
        </VaultSection>

        <VaultSection title="Kupony bonusowe">
          {coupons.length ? (
            <div className="vault-list">
              {coupons.map((c) => (
                <div key={c.id} className="vault-row">
                  <span className="vault-row__icon vault-row__icon--accent">
                    <Gift size={15} />
                  </span>
                  <span className="vault-row__text">
                    <span className="vault-row__title">{c.title}</span>
                    <span className="vault-row__meta">{[c.subtitle, c.meta].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.pillLabel ? <span className="vault-row__pill">{c.pillLabel}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="vault-empty">Brak aktywnych kuponów.</p>
          )}
        </VaultSection>
      </div>
    </VaultModal>
  );
}
