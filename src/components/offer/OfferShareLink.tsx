"use client";

import { useMemo, useState } from "react";
import { Link2, Check, ExternalLink } from "lucide-react";

const DEFAULT_ORIGIN = "https://estateos.pl";

function resolveOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const env = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
  return env || DEFAULT_ORIGIN;
}

type OfferShareLinkProps = {
  offerId: number;
};

export default function OfferShareLink({ offerId }: OfferShareLinkProps) {
  if (!Number.isFinite(offerId)) return null;
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => `${resolveOrigin()}/o/${offerId}`, [offerId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Skopiuj link:", shareUrl);
    }
  };

  return (
    <div className="rounded-[1.25rem] border border-[#D4AF37]/25 bg-gradient-to-b from-[#D4AF37]/[0.06] to-transparent px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={14} className="text-[#D4AF37]" aria-hidden />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
          Udostępnij wizytówkę
        </span>
      </div>
      <p className="text-[9px] text-white/45 leading-relaxed mb-2.5 font-medium">
        Krótki link z podglądem oferty — wygodny do social i wiadomości. Po kliknięciu z telefonu może otworzyć aplikację EstateOS (Universal Links).
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/10 px-3 py-2 font-mono text-[10px] text-white/70 truncate select-all">
          {shareUrl}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={copy}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#D4AF37]/90 hover:bg-[#D4AF37] text-black text-[9px] font-black uppercase tracking-widest transition-colors"
          >
            {copied ? (
              <span className="inline-flex items-center gap-1.5 justify-center">
                <Check size={14} strokeWidth={3} /> Skopiowano
              </span>
            ) : (
              "Kopiuj"
            )}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Otwórz wizytówkę w nowej karcie"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
