"use client";

import { useCallback, useEffect, useState } from "react";
import EosCreditCoin from "@/components/wallet/EosCreditCoin";
import PublicationWalletModal from "@/components/wallet/PublicationWalletModal";

type WalletSnapshot = {
  plusCredits: number;
};

function computeDisplayCredits(wallet: WalletSnapshot | null): number | null {
  if (!wallet) return null;
  return Math.max(0, wallet.plusCredits);
}

export default function PublicationWalletNavButton() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const refreshWallet = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/user/publication-wallet?locale=pl", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (!silent) setWallet(null);
        return;
      }
      setWallet({
        plusCredits: Number(data.plusCredits || 0),
      });
    } catch {
      if (!silent) setWallet(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWallet(false);
    const interval = window.setInterval(() => void refreshWallet(true), 120_000);
    const onRefresh = () => void refreshWallet(true);
    window.addEventListener("publicationWalletRefresh", onRefresh);

    const params = new URLSearchParams(window.location.search);
    const plusState = params.get("plus");
    if (plusState === "success") {
      void refreshWallet(true);
    }
    if (plusState === "success" || plusState === "cancel") {
      params.delete("plus");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("publicationWalletRefresh", onRefresh);
    };
  }, [refreshWallet]);

  const displayCredits = computeDisplayCredits(wallet);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        aria-label={`Kredyty publikacji: ${loading ? "ładowanie" : displayCredits ?? 0}`}
        className="group relative rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1.5 transition-colors hover:border-amber-600/25"
      >
        <EosCreditCoin count={displayCredits} loading={loading} spinning={isHovered} />
      </button>

      <PublicationWalletModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          void refreshWallet(true);
        }}
      />
    </>
  );
}
