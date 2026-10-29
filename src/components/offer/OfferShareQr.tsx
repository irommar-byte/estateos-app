"use client";

import { buildOfferShareQrSrc } from "@/lib/offerSharePrint";

type OfferShareQrProps = {
  url: string;
  label: string;
  caption: string;
};

export default function OfferShareQr({ url, label, caption }: OfferShareQrProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#e4dccd] p-3.5 dark:border-[#d8c3a0]/15">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={buildOfferShareQrSrc(url, 240)} alt={label} width={96} height={96} className="block size-24 shrink-0 rounded-lg bg-white p-1.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a6a3a] dark:text-[#d8c3a0]">{label}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-[#4a4740] dark:text-[#c8c0b3]">{caption}</p>
      </div>
    </div>
  );
}
