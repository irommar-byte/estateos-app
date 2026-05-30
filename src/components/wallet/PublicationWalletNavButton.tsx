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

  const refreshWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/user/publication-wallet?locale=pl", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setWallet(null);
        return;
      }
      setWallet({
        plusCredits: Number(data.plusCredits || 0),
      });
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWallet();
    const interval = window.setInterval(refreshWallet, 20_000);
    const onRefresh = () => void refreshWallet();
    window.addEventListener("publicationWalletRefresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);

    const params = new URLSearchParams(window.location.search);
    if (params.get("plus") === "success") {
      void refreshWallet();
      params.delete("plus");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("publicationWalletRefresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
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
        onClose={() => setIsOpen(false)}
        onWalletChange={() => void refreshWallet()}
      />
    </>
  );
}
