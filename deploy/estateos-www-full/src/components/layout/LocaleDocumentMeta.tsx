"use client";

import { useEffect } from "react";
import { useLocale } from "@/contexts/LocaleContext";

/** Syncs document title with active locale (cookie-driven UI). */
export default function LocaleDocumentMeta() {
  const { dict } = useLocale();

  useEffect(() => {
    document.title = dict.meta.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", dict.meta.description);
  }, [dict.meta.title, dict.meta.description]);

  return null;
}
