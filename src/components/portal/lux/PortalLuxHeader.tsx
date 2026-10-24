"use client";

import { Bell, MessageCircle, Phone } from "lucide-react";

export type LuxStageBar = { done: number; total: number };

type Props = {
  greeting: string;
  headline: string;
  bar: LuxStageBar;
  agencyName: string;
  agencyLogo?: string | null;
  agentName: string;
  agentPhoto?: string | null;
  agentTitle?: string | null;
  agentPhone?: string | null;
  partnerName?: string | null;
  onChat: () => void;
  /** dzwonek z powiadomieniami (prawy górny róg) */
  bell?: React.ReactNode;
  children?: React.ReactNode;
};

/** Czarny nagłówek panelu: logo EstateOS, biuro, powitanie, postęp i karta agenta. */
export default function PortalLuxHeader(props: Props) {
  const phone = props.agentPhone ? props.agentPhone.replace(/[^\d+]/g, "") : "";
  const monogram = (props.agencyName || "E").trim().charAt(0).toUpperCase();
  return (
    <header className="rounded-b-[32px] bg-black px-5 pb-6 pt-5 text-[#F6F3EE] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between">
          <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="mt-2 h-[26px] w-auto" />
          {props.bell ?? (
            <span className="flex size-10 items-center justify-center rounded-full border border-[#D8C3A0]/35" aria-hidden>
              <Bell className="size-[17px] text-[#D8C3A0]" />
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {props.agencyLogo ? (
            <img src={props.agencyLogo} alt={props.agencyName} className="h-8 max-w-[120px] rounded-md bg-white object-contain p-1" />
          ) : (
            <span className="lux-serif flex size-[30px] items-center justify-center rounded-full border border-[#D8C3A0] text-[15px] text-[#D8C3A0]">
              {monogram}
            </span>
          )}
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.22em] text-[#D8C3A0]">
            {props.agencyName} · Private Client
          </span>
        </div>

        <p className="mt-5 text-sm text-[#BDB6AA]">
          {props.greeting}
          {props.partnerName ? " · dostęp dla drugiej osoby" : ""}
        </p>
        <h1 className="lux-serif mt-1.5 text-[30px] font-medium leading-[1.1] sm:text-[36px]">{props.headline}</h1>

        <div className="mt-5 flex items-center gap-2.5" aria-label={`Etap ${props.bar.done} z ${props.bar.total}`}>
          <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${props.bar.total}, minmax(0, 1fr))` }}>
            {Array.from({ length: props.bar.total }).map((_, index) => (
              <span
                key={index}
                className={`h-[3px] rounded-full ${index < props.bar.done ? "bg-[#D8C3A0]" : "bg-[#D8C3A0]/25"}`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-[#D8C3A0]">
            {props.bar.done} / {props.bar.total}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[20px] border border-[#D8C3A0]/20 bg-white/[0.06] p-3">
          {props.agentPhoto ? (
            <img src={props.agentPhoto} alt="" className="size-[46px] shrink-0 rounded-full border border-[#D8C3A0] object-cover" />
          ) : (
            <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full border border-[#D8C3A0] bg-[#3a3d42] font-bold text-[#D8C3A0]">
              {props.agentName.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{props.agentName}</p>
            <p className="truncate text-xs text-[#BDB6AA]">{props.agentTitle || "Twój agent"}</p>
          </div>
          {phone ? (
            <a
              href={`tel:${phone}`}
              aria-label="Zadzwoń do agenta"
              className="flex size-[42px] items-center justify-center rounded-full border border-[#D8C3A0]/45"
            >
              <Phone className="size-[17px] text-[#F6F3EE]" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={props.onChat}
            aria-label="Napisz do agenta"
            className="flex size-[42px] items-center justify-center rounded-full bg-[#D8C3A0]"
          >
            <MessageCircle className="size-[17px] text-black" />
          </button>
        </div>
        {props.children}
      </div>
    </header>
  );
}
