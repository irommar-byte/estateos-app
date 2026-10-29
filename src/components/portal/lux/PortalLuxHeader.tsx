"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bell, Check, MessageCircle, Phone } from "lucide-react";
import { usePortalLocale } from "@/components/portal/PortalLocale";

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
  /** jedna rzecz, którą klient ma teraz zrobić (albo informacja, że nic nie musi) */
  nextStep?: { title: string; body?: string | null; tone: "action" | "info" | "done"; cta?: string; onClick?: () => void } | null;
  /** przełącznik języka panelu (PL / EN / UA) obok dzwonka */
  languageSwitch?: React.ReactNode;
  children?: React.ReactNode;
};

/** Czarny nagłówek panelu: logo EstateOS, biuro, powitanie, postęp i karta agenta. */
export default function PortalLuxHeader(props: Props) {
  const reduce = useReducedMotion();
  const { t } = usePortalLocale();
  const phone = props.agentPhone ? props.agentPhone.replace(/[^\d+]/g, "") : "";
  const monogram = (props.agencyName || "E").trim().charAt(0).toUpperCase();
  return (
    <header id="portal-header" className="rounded-b-[32px] bg-black px-5 pb-6 pt-5 text-[#F6F3EE] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between">
          <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="mt-2 h-[26px] w-auto" />
          <div className="flex items-center gap-2">
            {props.languageSwitch}
            {props.bell ?? (
              <span className="flex size-10 items-center justify-center rounded-full border border-[#D8C3A0]/35" aria-hidden>
                <Bell className="size-[17px] text-[#D8C3A0]" />
              </span>
            )}
          </div>
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
          {props.partnerName ? ` · ${t("dostęp dla drugiej osoby")}` : ""}
        </p>
        <h1 className="lux-serif mt-1.5 text-[30px] font-medium leading-[1.1] sm:text-[36px]">{props.headline}</h1>

        {/* Pasek etapów: przy wejściu wypełnia się kolejno do bieżącego etapu */}
        <div className="mt-5 flex items-center gap-2.5" aria-label={t("Zakończone etapy: {n} z {total}", { n: props.bar.done, total: props.bar.total })}>
          <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${props.bar.total}, minmax(0, 1fr))` }}>
            {Array.from({ length: props.bar.total }).map((_, index) => {
              const done = index < props.bar.done;
              const current = index === props.bar.done;
              return (
                <span key={index} className="relative h-[3px] overflow-hidden rounded-full bg-[#D8C3A0]/22">
                  {done ? (
                    <motion.span
                      className="absolute inset-0 origin-left rounded-full bg-[#D8C3A0]"
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.42, delay: 0.25 + index * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  ) : current ? (
                    <motion.span
                      className="eos-seg-current absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#D8C3A0]"
                      initial={reduce ? false : { scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.5, delay: 0.25 + index * 0.12 }}
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
          <span className="text-xs font-semibold tabular-nums text-[#D8C3A0]">
            {props.bar.done} / {props.bar.total}
          </span>
        </div>

        {props.nextStep ? (
          <motion.button
            type="button"
            onClick={props.nextStep.onClick}
            disabled={!props.nextStep.onClick}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 + props.bar.total * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            whileTap={{ scale: 0.985 }}
            className={`group mt-4 flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left transition-colors ${
              props.nextStep.tone === "action"
                ? "bg-[#D8C3A0] text-black hover:bg-[#E2CFAF]"
                : "border border-[#D8C3A0]/25 bg-transparent text-[#F6F3EE]"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block text-[12px] font-semibold ${props.nextStep.tone === "action" ? "text-black/60" : "text-[#BDB6AA]"}`}>
                {props.nextStep.tone === "action" ? t("Twój następny krok") : props.nextStep.tone === "done" ? t("Wszystko na bieżąco") : t("Teraz")}
              </span>
              <span className="mt-0.5 block text-[15.5px] font-bold leading-snug">{props.nextStep.title}</span>
              {props.nextStep.body ? (
                <span className={`mt-0.5 line-clamp-2 block text-[12.5px] leading-snug ${props.nextStep.tone === "action" ? "text-black/70" : "text-[#BDB6AA]"}`}>
                  {props.nextStep.body}
                </span>
              ) : null}
            </span>
            {props.nextStep.onClick ? (
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 ${
                  props.nextStep.tone === "action" ? "bg-black text-[#D8C3A0]" : "border border-[#D8C3A0]/40 text-[#D8C3A0]"
                }`}
                aria-hidden
              >
                {props.nextStep.tone === "done" ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
              </span>
            ) : null}
            {props.nextStep.cta ? <span className="sr-only">{props.nextStep.cta}</span> : null}
          </motion.button>
        ) : null}

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
            <p className="truncate text-xs text-[#BDB6AA]">{props.agentTitle ? t(props.agentTitle) : t("Twój agent")}</p>
          </div>
          {phone ? (
            <a
              href={`tel:${phone}`}
              aria-label={t("Zadzwoń do agenta")}
              className="flex size-[42px] items-center justify-center rounded-full border border-[#D8C3A0]/45"
            >
              <Phone className="size-[17px] text-[#F6F3EE]" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={props.onChat}
            aria-label={t("Napisz do agenta")}
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
