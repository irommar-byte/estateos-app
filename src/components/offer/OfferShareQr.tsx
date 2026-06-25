"use client";

type OfferShareQrProps = {
  url: string;
  label: string;
  caption: string;
};

export default function OfferShareQr({ url, label, caption }: OfferShareQrProps) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&bgcolor=ffffff&color=141416&data=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="shrink-0 rounded-xl border border-black/10 bg-white p-2 shadow-sm dark:border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt={label} width={128} height={128} className="block size-32" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b8922e]">{label}</p>
        <p className="mt-2 text-sm font-semibold leading-snug text-[#141416] dark:text-white">{caption}</p>
        <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
          {url}
        </p>
      </div>
    </div>
  );
}
