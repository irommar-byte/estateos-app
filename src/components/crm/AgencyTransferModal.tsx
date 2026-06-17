"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, X } from "lucide-react";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";

type Agency = {
  id: number;
  displayName: string;
  image: string | null;
  averageRating: number | null;
  reviewsCount: number;
};

type Props = {
  offerId: number;
  offerTitle?: string;
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
};

export default function AgencyTransferModal({ offerId, offerTitle, open, onClose, onSent }: Props) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/agencje", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAgencies(Array.isArray(d.agencies) ? d.agencies : []))
      .finally(() => setLoading(false));
  }, [open]);

  const requestTransfer = async (agencyId: number) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/concierge/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, agencyId }),
      });
      if (res.ok) {
        setSuccess(true);
        onSent?.();
      } else {
        alert("Nie udało się wysłać zapytania. Zaloguj się i spróbuj ponownie.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center overflow-y-auto bg-black/85 p-4 pt-16 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={() => {
            onClose();
            setSuccess(false);
          }}
          className="absolute right-5 top-5 text-white/40 hover:text-white"
        >
          <X className="size-5" />
        </button>

        {success ? (
          <div className="py-8 text-center">
            <p className="text-2xl font-black text-emerald-400">Wysłano zapytanie</p>
            <p className="mt-3 text-sm text-white/50">
              Agencja przeanalizuje ofertę i prześle warunki współpracy. Po Twojej akceptacji przejmie sprzedaż — Ty
              zachowasz podgląd bez obowiązku odbierania telefonów.
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-black text-white">Oddaj do agencji</h3>
            <p className="mt-2 text-sm text-white/50">
              {offerTitle ? `„${offerTitle}”` : `Oferta #${offerId}`} — wybierz biuro, które przejmie sprzedaż.
            </p>
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
                      disabled={submitting}
                      onClick={() => void requestTransfer(a.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-emerald-500/40 disabled:opacity-50"
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black">
                        {avatar ? (
                          <img src={avatar} alt="" className="size-full object-cover" />
                        ) : (
                          <Building2 className="size-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">{a.displayName}</p>
                        <p className="text-[10px] text-white/40">
                          {a.averageRating != null ? `${a.averageRating} ★ · ` : ""}
                          {a.reviewsCount} opinii
                        </p>
                      </div>
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
