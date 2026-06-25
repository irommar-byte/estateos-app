"use client";

import Link from "next/link";
import { MessageCircle, Star, UserPlus } from "lucide-react";
import type { OfferSharePublisher } from "@/lib/offerShareLanding";

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function OfferSharePublisherCard({
  publisher,
  contactHref,
}: {
  publisher: OfferSharePublisher;
  contactHref: string;
}) {
  const primaryName = publisher.personName || publisher.displayName;
  const kicker = publisher.isPresentingAgent
    ? "Twój doradca przy tej ofercie"
    : publisher.isAgent
      ? "Biuro nieruchomości"
      : "Wystawca oferty";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#b8922e]/30 bg-gradient-to-br from-[#faf8f2] to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:from-[#141416] dark:to-[#101014]">
      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#b8922e]">{kicker}</p>
      <div className="mt-4 flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="size-16 overflow-hidden rounded-2xl border-2 border-[#b8922e]/35 bg-[#141416] shadow-lg">
            {publisher.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publisher.imageUrl} alt={primaryName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-black text-white">
                {initialsFrom(primaryName)}
              </div>
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[#101014]" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-tight text-[#141416] dark:text-white">{primaryName}</h2>
          {publisher.companyName && publisher.companyName !== primaryName ? (
            <p className="mt-1 text-sm font-semibold text-[#5c5c66] dark:text-[#9a9aa8]">{publisher.companyName}</p>
          ) : null}
          {publisher.reviewCount > 0 && publisher.averageRating != null ? (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={12}
                    className={
                      star <= Math.round(publisher.averageRating || 0)
                        ? "fill-amber-400 text-amber-400"
                        : "text-black/15 dark:text-white/15"
                    }
                  />
                ))}
              </div>
              <span className="text-[11px] font-bold text-[#5c5c66] dark:text-[#9a9aa8]">
                {publisher.averageRating.toFixed(1)} · {publisher.reviewCount} opinii
              </span>
            </div>
          ) : null}
          <Link
            href={publisher.profileHref}
            className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-500"
          >
            Zobacz profil publiczny
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href={contactHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.18em] text-black shadow-[0_8px_24px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          <UserPlus size={15} />
          Skontaktuj się
        </Link>
        <Link
          href={contactHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/70 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#141416] transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <MessageCircle size={15} />
          Napisz wiadomość
        </Link>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
        Bezpłatna rejestracja na EstateOS™ — weryfikacja użytkowników, Deal Room i bezpieczny kontakt z wystawcą.
      </p>
    </section>
  );
}
