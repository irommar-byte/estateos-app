"use client";

import { useState } from "react";
import { importPortalBadge, type ImportPortalBadge } from "@/lib/crm/importPortalBadge";

export type MatchImportBrief = {
  badge: ImportPortalBadge | null;
  source?: string | null;
  url: string | null;
  titleOriginal?: string | null;
  descriptionOriginal?: string | null;
  phone?: string | null;
  agencyName?: string | null;
  contactAddress?: string | null;
  advertiserType?: string | null;
  smartAdd?: string[];
  userNote?: string | null;
};

const BADGE_CLASS: Record<ImportPortalBadge, string> = {
  OTO: "bg-[#FF4D4F] text-white",
  OLX: "bg-[#002F34] text-[#23E5DB]",
  "N-O": "bg-[#1B4F72] text-white",
};

export function PortalSourceBadge({
  badge,
  url,
}: {
  badge?: ImportPortalBadge | null;
  url?: string | null;
}) {
  const resolved = badge || importPortalBadge(null, url);
  if (!resolved) return null;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide ${BADGE_CLASS[resolved]}`}>
      {resolved}
    </span>
  );
}

export default function MatchImportAgentMeta({ brief }: { brief?: MatchImportBrief | null }) {
  const [open, setOpen] = useState(false);
  if (!brief || (!brief.badge && !brief.url && !brief.descriptionOriginal && !brief.phone && !brief.smartAdd?.length)) {
    return null;
  }
  const contact = [brief.agencyName, brief.phone, brief.contactAddress].filter(Boolean).join(" · ");
  const hasComments = Boolean(
    brief.descriptionOriginal || contact || brief.smartAdd?.length || brief.userNote || brief.titleOriginal,
  );

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <PortalSourceBadge badge={brief.badge} url={brief.url} />
        {brief.url ? (
          <a
            href={brief.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-extrabold text-sky-600 hover:underline"
          >
            Oryginał na portalu
          </a>
        ) : null}
        {hasComments ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-[11px] font-extrabold text-[var(--eos-muted)]"
          >
            {open ? "Ukryj komentarz importu" : "Komentarz importu"}
          </button>
        ) : null}
      </div>
      {open && hasComments ? (
        <div className="rounded-xl bg-violet-500/10 px-3 py-2 text-[11px] leading-5 text-[var(--eos-text)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-violet-700">Tylko dla agenta</p>
          {brief.titleOriginal ? <p className="mt-1 font-semibold">{brief.titleOriginal}</p> : null}
          {contact ? <p>{contact}</p> : null}
          {brief.advertiserType ? <p className="opacity-70">Ogłoszeniodawca: {brief.advertiserType}</p> : null}
          {brief.smartAdd?.length ? <p>Wykryte: {brief.smartAdd.join(", ")}</p> : null}
          {brief.descriptionOriginal ? <p className="opacity-80">{brief.descriptionOriginal}</p> : null}
          {brief.userNote ? <p>Notatka: {brief.userNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
