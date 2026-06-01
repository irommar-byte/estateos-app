"use client";

import {
  sanitizeOfferDescriptionHtml,
  shouldRenderOfferDescriptionAsHtml,
  stripHtmlToPlain,
} from "@/lib/offerDescriptionHtml";

type Props = {
  description: string;
  className?: string;
};

export default function OfferDescriptionBody({ description, className = "" }: Props) {
  const safe = sanitizeOfferDescriptionHtml(description);
  const renderAsHtml =
    shouldRenderOfferDescriptionAsHtml(description) ||
    shouldRenderOfferDescriptionAsHtml(safe);

  if (renderAsHtml && safe) {
    return (
      <div
        className={`offer-description-html text-base font-light leading-relaxed text-[var(--eos-muted)] break-words sm:text-lg [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_strong]:text-[var(--eos-text)] ${className}`}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }

  const plain = stripHtmlToPlain(safe || description);

  return (
    <p className={`text-base font-light leading-relaxed text-[var(--eos-muted)] whitespace-pre-line break-words sm:text-lg ${className}`}>
      {plain}
    </p>
  );
}
