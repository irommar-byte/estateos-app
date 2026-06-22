"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ChevronRight, Loader2, Shield, X } from "lucide-react";
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
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
        credentials: "include",
        body: JSON.stringify({ offerId, agencyId }),
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center overflow-y-auto bg-black/85 p-4 pt-16 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={() => {
            onClose();
            setStep(1);
          }}
          className="absolute right-5 top-5 text-white/40 hover:text-white"
        >
          <X className="size-5" />
        </button>

        {step === 3 ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
            <p className="mt-4 text-2xl font-black text-emerald-400">Zapytanie wysłane</p>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Agencja otrzymała powiadomienie i przeanalizuje Twoje ogłoszenie. Gdy prześle warunki
              współpracy, dostaniesz alert — zaakceptujesz je jednym kliknięciem w panelu CRM.
            </p>
            <p className="mt-4 text-xs text-white/40">
              Do tego czasu oferta pozostaje u Ciebie. Nic nie zmienia się bez Twojej zgody.
            </p>
          </div>
        ) : step === 1 ? (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Concierge</p>
            <h3 className="mt-2 text-2xl font-black text-white">Oddaj sprzedaż profesjonalnej agencji</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              {offerTitle ? `„${offerTitle}”` : `Oferta #${offerId}`} — wybierz biuro, które przejmie
              kontakt z kupującymi i doprowadzi transakcję do końca.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="flex items-center gap-2 font-bold text-white">
                <Shield className="size-4 text-emerald-400" />
                Co się stanie?
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-emerald-400">1.</span> Wybierasz agencję — wysyłamy im podgląd ogłoszenia.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">2.</span> Biuro proponuje prowizję i zakres usług (sesja, marketing, wizyty).
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">3.</span> Po Twojej akceptacji agencja przejmuje sprzedaż — Ty masz podgląd bez telefonów.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-widest text-black"
            >
              Wybierz agencję <ChevronRight className="size-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white"
            >
              ← Wróć do wyjaśnienia
            </button>
            <h3 className="text-xl font-black text-white">Wybierz biuro</h3>
            <p className="mt-2 text-sm text-white/50">Katalog zweryfikowanych partnerów EstateOS™.</p>
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
                      <ChevronRight className="size-4 text-white/30" />
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
