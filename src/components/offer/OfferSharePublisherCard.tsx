"use client";

import Link from "next/link";
import { CalendarDays, MessageCircle, Star } from "lucide-react";
import type { OfferSharePublisher } from "@/lib/offerShareLanding";

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function OfferSharePublisherCard({
  publisher,
  onScheduleVisit,
  onWriteMessage,
}: {
  publisher: OfferSharePublisher;
  onScheduleVisit: () => void;
  onWriteMessage: () => void;
}) {
  const primaryName = publisher.personName || publisher.displayName;
  const kicker = publisher.isPresentingAgent
    ? "Twój doradca przy tej ofercie"
    : publisher.isAgent
      ? "Biuro nieruchomości"
      : "Wystawca oferty";

  return (
    <section className="rounded-2xl border border-[#e4dccd] bg-[#f8f5ef] p-4 dark:border-[#d8c3a0]/15 dark:bg-[#1c1a17]">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a6a3a] dark:text-[#d8c3a0]">{kicker}</p>
      <div className="mt-4 flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="size-16 overflow-hidden rounded-full bg-[#141416] ring-1 ring-[#a8844e] ring-offset-2 ring-offset-[#f8f5ef] dark:ring-offset-[#1c1a17]">
            {publisher.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publisher.imageUrl} alt={primaryName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#141416] text-lg font-semibold text-[#d8c3a0]">
                {initialsFrom(primaryName)}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-[family-name:var(--ofb-serif)] text-[20px] font-medium leading-tight text-[#141416] dark:text-[#f3eee6]">{primaryName}</h2>
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
            className="mt-2 inline-block text-[11px] font-semibold text-[#8a6a3a] underline underline-offset-2 dark:text-[#d8c3a0]"
          >
            Zobacz profil publiczny
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onScheduleVisit}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#15171a] text-[13px] font-semibold text-[#d8c3a0] dark:bg-[#d8c3a0] dark:text-[#0c0b0a]"
        >
          <CalendarDays size={15} />
          Umów wizytę
        </button>
        <button
          type="button"
          onClick={onWriteMessage}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d5ccbd] text-[13px] font-semibold text-[#15171a] dark:border-[#d8c3a0]/25 dark:text-[#f3eee6]"
        >
          <MessageCircle size={15} />
          Napisz wiadomość
        </button>
      </div>
    </section>
  );
}
