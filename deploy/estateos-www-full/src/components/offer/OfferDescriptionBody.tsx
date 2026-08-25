"use client";

import { listingDescriptionToSafeHtml } from "@/lib/offerDescriptionHtml";

type Props = {
  description: string;
  className?: string;
};

export default function OfferDescriptionBody({ description, className = "" }: Props) {
  const safe = listingDescriptionToSafeHtml(description);

  if (!safe) return null;

  return (
    <div
      className={`offer-description-html break-words text-[17px] font-light leading-[1.8] tracking-[0.015em] text-[var(--eos-muted)] [text-shadow:0_1px_0_rgba(255,255,255,0.55)] sm:text-lg dark:[text-shadow:0_1px_1px_rgba(0,0,0,0.35)] [&_em]:italic [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-[11px] [&_h3]:font-light [&_h3]:uppercase [&_h3]:tracking-[0.2em] [&_h3]:text-[var(--eos-text)] [&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#c4a574]/45 [&_li]:mb-1.5 [&_p]:mb-4 [&_strong]:font-medium [&_strong]:text-[var(--eos-text)] [&_u]:underline [&_u]:decoration-[#c4a574]/70 [&_ul]:mb-5 [&_ul]:list-none [&_ul]:pl-0 [&_ul_li]:relative [&_ul_li]:pl-5 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:text-[#c4a574] [&_ul_li]:before:content-['•'] [&_ul_li[data-kind=check]]:before:content-['✓'] ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
