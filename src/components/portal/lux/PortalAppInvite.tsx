"use client";

import { Smartphone } from "lucide-react";

/** Wejście do aplikacji EstateOS: kod QR albo 6 cyfr. */
export default function PortalAppInvite({ invite }: { invite: { code: string; link: string; qrSvg?: string } }) {
  const code = invite.code;
  return (
    <section className="lux-card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {invite.qrSvg ? (
          <div
            className="mx-auto size-[168px] shrink-0 overflow-hidden rounded-2xl border border-[#E6E0D6] bg-white p-2 sm:mx-0 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="lux-kicker flex items-center gap-2">
            <Smartphone className="size-4" aria-hidden /> Aplikacja na iPhone
          </p>
          <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">Panel zawsze pod ręką</h3>
          <ol className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#45423C]">
            <li>1. Pobierz aplikację EstateOS z App Store.</li>
            <li>2. Wybierz „Jestem klientem”.</li>
            <li>3. Zeskanuj kod albo wpisz cyfry poniżej.</li>
          </ol>
          <p className="mt-3 font-mono text-[26px] font-bold tracking-[0.3em] text-[#15171A]" aria-label={`Kod: ${code.split("").join(" ")}`}>
            {code.slice(0, 3)} {code.slice(3)}
          </p>
          <p className="mt-1 text-[12px] text-[#5B574F]">Powiadomienia ustawisz w aplikacji. Kod działa tylko dla Twojego panelu.</p>
        </div>
      </div>
    </section>
  );
}
