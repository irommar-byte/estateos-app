"use client";

import { useLocale } from "@/contexts/LocaleContext";
import { getContactInboxDictionary } from "@/i18n/contactInboxDictionary";

export default function ContactInboxLoading() {
  const { locale } = useLocale();
  const d = getContactInboxDictionary(locale);
  return <div className="p-10 text-center text-[var(--eos-muted)]">{d.loading}</div>;
}
