"use client";

import Link from "next/link";
import { CalendarIcon, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { buildAuthHref, type OfferShareIntentKind } from "@/lib/offerShareIntent";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import EosModal from "@/components/ui/EosModal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  kind: OfferShareIntentKind;
  returnPath: string;
  publisherName?: string;
  slotLabel?: string;
  messagePreview?: string;
};

export default function OfferShareAuthPrompt({
  isOpen,
  onClose,
  kind,
  returnPath,
  publisherName,
  slotLabel,
  messagePreview,
}: Props) {
  const isAppointment = kind === "appointment";
  const loginHref = buildAuthHref("login", returnPath, kind);
  const registerHref = buildAuthHref("register", returnPath, kind);

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="sheet"
      maxWidth="max-w-md"
      hideHeader
      hideBodyPadding
    >
      <div className="border-b border-black/8 px-6 py-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {isAppointment ? <CalendarIcon size={22} /> : <MessageCircle size={22} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b8922e]">Krok ostatni</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-[#141416] dark:text-white">
              {isAppointment ? "Potwierdź termin wizyty" : "Wyślij wiadomość"}
            </h3>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        <p className="text-sm leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
          {isAppointment ? (
            <>
              Twój wybrany termin jest zapisany. Załóż bezpłatne konto lub zaloguj się, aby wysłać prośbę do{" "}
              <strong className="text-[#141416] dark:text-white">{publisherName || "wystawcy"}</strong> w Deal Room.
            </>
          ) : (
            <>
              Twoja wiadomość jest gotowa. Zaloguj się lub załóż konto, aby bezpiecznie wysłać ją do{" "}
              <strong className="text-[#141416] dark:text-white">{publisherName || "wystawcy"}</strong>.
            </>
          )}
        </p>

        {slotLabel ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300">
            <CalendarIcon size={16} className="shrink-0" />
            {slotLabel}
          </div>
        ) : null}

        {messagePreview ? (
          <blockquote className="rounded-2xl border border-black/8 bg-white/70 px-4 py-3 text-sm italic text-[#5c5c66] dark:border-white/10 dark:bg-white/5 dark:text-[#9a9aa8]">
            „{messagePreview.length > 140 ? `${messagePreview.slice(0, 140)}…` : messagePreview}”
          </blockquote>
        ) : null}

        <div className="flex items-start gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 dark:bg-white/[0.04]">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
            Weryfikacja użytkowników, Deal Room i bezpieczny kontakt — bez opłat za rejestrację.
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-black/8 px-6 py-5 dark:border-white/10">
        <Link href={registerHref} className={eosBtn("primary", { block: true, size: "lg" })} onClick={onClose}>
          <Sparkles size={15} />
          Załóż bezpłatne konto
        </Link>
        <Link href={loginHref} className={eosBtn("secondary", { block: true })} onClick={onClose}>
          Mam już konto — zaloguj się
        </Link>
      </div>
    </EosModal>
  );
}
