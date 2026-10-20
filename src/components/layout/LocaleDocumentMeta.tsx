"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";

/** Legal and product pages keep the title from their own metadata. */
const KEEP_PAGE_TITLE = /^\/(galleryos|paragonos|polityka-prywatnosci|regulamin|privacy-policy)(\/|$)/;

/** Syncs document title with active locale (cookie-driven UI). */
export default function LocaleDocumentMeta() {
  const { dict } = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    if (KEEP_PAGE_TITLE.test(pathname || "")) return;
    document.title = dict.meta.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", dict.meta.description);
  }, [dict.meta.title, dict.meta.description, pathname]);

  return null;
}
