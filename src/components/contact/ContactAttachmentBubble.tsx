"use client";

import { FileText, Film, Music } from "lucide-react";
import {
  ContactAttachmentMeta,
  contactAttachmentKind,
  formatContactAttachmentName,
  formatContactBytes,
} from "@/lib/contactAttachmentShared";

type Props = {
  attachment: ContactAttachmentMeta;
  isMe: boolean;
};

export default function ContactAttachmentBubble({ attachment, isMe }: Props) {
  const kind = contactAttachmentKind(attachment);
  const displayName = formatContactAttachmentName(attachment.name);
  const linkClass = isMe
    ? "text-current/80 hover:text-current"
    : "text-[#a8844c] hover:text-[#7a5f33]";

  if (kind === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]"
      >
        <img
          src={attachment.url}
          alt={displayName}
          className="max-h-64 w-full max-w-[min(100%,280px)] object-cover"
          loading="lazy"
        />
        <p className={`px-3 py-2 text-[11px] font-medium ${isMe ? "text-current/70" : "text-[var(--eos-muted)]"}`}>
          {displayName}
          {attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ""}
        </p>
      </a>
    );
  }

  if (kind === "audio") {
    return (
      <div className="mt-2 w-full min-w-[220px] max-w-[300px] rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3 shadow-sm">
        <div className="mb-2 flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#a8844c]/15 text-[#a8844c]">
            <Music className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[var(--eos-text)]">Nagranie audio</p>
            <p className="truncate text-[10px] text-[var(--eos-muted)]" title={displayName}>
              {displayName}
            </p>
          </div>
        </div>
        <audio
          controls
          preload="metadata"
          className="h-9 w-full"
          src={attachment.url}
          aria-label={`Odtwórz nagranie audio: ${displayName}`}
        >
          <a href={attachment.url} className={linkClass}>
            Pobierz audio
          </a>
        </audio>
        {attachment.size > 0 ? (
          <p className="mt-1.5 text-right text-[9px] font-semibold text-[var(--eos-muted)]">
            {formatContactBytes(attachment.size)}
          </p>
        ) : null}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
        <video controls preload="metadata" className="max-h-64 w-full max-w-[min(100%,320px)] bg-black" src={attachment.url} />
        <p className={`truncate px-3 py-2 text-[11px] ${isMe ? "text-current/70" : "text-[var(--eos-muted)]"}`}>{displayName}</p>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-2 flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
          isMe
            ? "border-current/15 bg-current/10 hover:bg-current/15"
            : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:bg-[var(--eos-input)]"
        }`}
      >
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            isMe ? "bg-current/15 text-current" : "bg-red-500/15 text-red-400"
          }`}
        >
          <FileText className="size-5" />
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${isMe ? "text-current" : "text-[var(--eos-text)]"}`}>
            {displayName}
          </p>
          <p className={`text-[11px] ${isMe ? "text-current/60" : "text-[var(--eos-muted)]"}`}>
            PDF{attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ""}
          </p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
        isMe
          ? "border-current/15 bg-current/10 hover:bg-current/15"
          : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:bg-[var(--eos-input)]"
      }`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
          isMe ? "bg-current/15 text-current" : "bg-[var(--eos-input)] text-[var(--eos-muted)]"
        }`}
      >
        {kind === "file" ? <FileText className="size-5" /> : <Film className="size-5" />}
      </div>
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${isMe ? "text-current" : "text-[var(--eos-text)]"}`}>
          {displayName}
        </p>
        <p className={`text-[11px] ${isMe ? "text-current/60" : "text-[var(--eos-muted)]"}`}>
          Plik{attachment.size > 0 ? ` · ${formatContactBytes(attachment.size)}` : ""}
        </p>
      </div>
    </a>
  );
}
