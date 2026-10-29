"use client";

import { FileText, ImageIcon } from "lucide-react";
import { fileKind } from "@/lib/portalUpload";
import { usePortalLocale } from "@/components/portal/PortalLocale";

/** Podgląd pliku w panelu: zdjęcie, PDF (pierwsze strony w ramce) albo karta z nazwą. */
export default function PortalFilePreview({
  src,
  name,
  mimeType,
  height = 340,
}: {
  src: string;
  name: string;
  mimeType?: string | null;
  height?: number;
}) {
  const { t } = usePortalLocale();
  const kind = fileKind({ name, type: mimeType || "" });
  if (kind === "image") {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-[18px] bg-[var(--lux-well)]" style={{ height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (kind === "pdf") {
    return (
      <div className="overflow-hidden rounded-[18px] border border-[var(--lux-line)] bg-[var(--lux-card)]" style={{ height }}>
        <iframe src={`${src}#toolbar=0&navpanes=0&view=FitH`} title={name} className="size-full" />
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-[#D8C3A0] bg-[var(--lux-well)] px-6 text-center"
      style={{ height: Math.min(height, 220) }}
    >
      {kind === "heic" ? <ImageIcon className="size-10 text-[var(--lux-gold-ink)]" /> : <FileText className="size-10 text-[var(--lux-gold-ink)]" />}
      <p className="max-w-full truncate text-[14px] font-bold">{name}</p>
      <p className="text-[12px] text-[var(--lux-ink-3)]">
        {kind === "heic"
          ? t("Zdjęcie z iPhone'a (HEIC) — ta przeglądarka nie pokaże podglądu, ale agent zobaczy je normalnie.")
          : t("Podgląd tego typu pliku nie jest dostępny w przeglądarce — agent otworzy go u siebie.")}
      </p>
    </div>
  );
}
