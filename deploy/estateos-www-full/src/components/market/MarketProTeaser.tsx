"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

type Props = {
  href?: string;
  ctaLabel?: string;
};

export default function MarketProTeaser({
  href = "/cennik",
  ctaLabel = "Odblokuj Pro",
}: Props) {
  return (
    <Link
      href={href}
      className="mt-8 block rounded-[1.75rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-6 md:p-8 transition hover:border-emerald-400/45 hover:from-emerald-500/[0.12]"
    >
      <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">
        <Scale size={14} /> EstateOS™ Market
      </p>
      <h3 className="text-xl font-black text-[var(--eos-text)] md:text-2xl">
        Sprawdź, czy cena jest dobra przy aktach
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
        Kliknij, aby zobaczyć jak daleko cena tej oferty odbiega od porównywalnych transakcji
        notarialnych (RCN). W Pro masz też taśmy „Przy aktach” w katalogu nieruchomości —
        bez Pro taśma jest po prostu niewidoczna.
      </p>
      <span className="mt-5 inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-black shadow-[0_10px_24px_rgba(16,185,129,0.28)]">
        {ctaLabel}
      </span>
    </Link>
  );
}
