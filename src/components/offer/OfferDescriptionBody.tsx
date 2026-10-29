"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { listingDescriptionToSafeHtml } from "@/lib/offerDescriptionHtml";

/** Wysokość zwiniętego opisu — długie opisy dostają „Czytaj całość” z płynnym rozwinięciem. */
const COLLAPSED_PX = 340;

type Props = {
  description: string;
  className?: string;
};

export default function OfferDescriptionBody({ description, className = "" }: Props) {
  const safe = listingDescriptionToSafeHtml(description);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [fullHeight, setFullHeight] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setFullHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [safe]);

  if (!safe) return null;
  const collapsible = fullHeight > COLLAPSED_PX + 120;

  return (
    <div className="relative">
    <div
      ref={bodyRef}
      style={collapsible ? { maxHeight: open ? fullHeight : COLLAPSED_PX, overflow: "hidden", transition: "max-height 0.6s cubic-bezier(0.22, 0.7, 0.2, 1)" } : undefined}
      className={`offer-description-html break-words font-[family-name:var(--font-geist-sans)] text-[17px] font-light leading-[1.85] tracking-[0.015em] text-[var(--eos-muted)] [text-shadow:0_1px_0_rgba(255,255,255,0.55)] sm:text-[18px] dark:[text-shadow:0_1px_1px_rgba(0,0,0,0.35)] [&_em]:italic [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-[var(--eos-text)] [&_hr]:my-7 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#c4a574]/45 [&_li]:mb-2 [&_p]:mb-4 [&_p:first-child]:text-[var(--eos-text)] [&_p:first-child]:opacity-95 [&_strong]:font-semibold [&_strong]:text-[var(--eos-text)] [&_u]:underline [&_u]:decoration-[#c4a574]/70 [&_ul]:mb-5 [&_ul]:list-none [&_ul]:pl-0 [&_ul_li]:relative [&_ul_li]:pl-5 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:text-[#c4a574] [&_ul_li]:before:content-['•'] [&_ul_li[data-kind=check]]:before:content-['✓'] ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
    {collapsible && !open ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-10 h-24 bg-gradient-to-t from-[var(--eos-bg)] to-transparent" />
    ) : null}
    {collapsible ? (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--eos-text)] underline-offset-4 hover:underline"
      >
        {open ? "Zwiń opis" : "Czytaj całość"}
        <ChevronDown size={16} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
    ) : null}
    </div>
  );
}
