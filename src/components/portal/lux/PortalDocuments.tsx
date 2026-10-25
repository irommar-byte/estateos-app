"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Circle, Clock3, Eye, MinusCircle, Plus, RefreshCw } from "lucide-react";
import LuxSheet from "@/components/portal/lux/LuxSheet";
import PortalFilePreview from "@/components/portal/lux/PortalFilePreview";
import PortalUploadSheet from "@/components/portal/lux/PortalUploadSheet";
import { PORTAL_UPLOAD_ACCEPT, PORTAL_UPLOAD_MAX_BYTES, fileKind, formatBytes } from "@/lib/portalUpload";

export type PortalDocument = {
  key: string;
  label: string;
  hint: string | null;
  required: boolean;
  custom?: boolean;
  status: "missing" | "uploaded" | "accepted" | "rejected" | "na";
  fileName: string | null;
  fileUrl: string | null;
  mimeType?: string | null;
  note: string | null;
  uploadedAt?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

export type PortalDocumentsSummary = {
  total?: number;
  required: number;
  done: number;
  missing: number;
  accepted?: number;
  rejected?: number;
  toReview?: number;
};

const STATUS = {
  missing: { label: "Brakuje", Icon: Circle, tone: "text-[var(--lux-ink-3)]" },
  uploaded: { label: "Wysłane — agent sprawdza", Icon: Clock3, tone: "text-[var(--lux-warn)]" },
  accepted: { label: "Gotowe", Icon: CheckCircle2, tone: "text-[var(--lux-good)]" },
  rejected: { label: "Do poprawy", Icon: AlertCircle, tone: "text-[var(--lux-danger)]" },
  na: { label: "Nie dotyczy", Icon: MinusCircle, tone: "text-[var(--lux-ink-3)]" },
} as const;

function plDocs(n: number) {
  if (n === 1) return "dokument";
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "dokumenty" : "dokumentów";
}

/** Liczy wszystko z listy — licznik zawsze zgadza się z tym, co klient widzi na ekranie. */
export function computeDocumentsSummary(documents: PortalDocument[]) {
  const total = documents.length;
  const accepted = documents.filter((d) => d.status === "accepted").length;
  const uploaded = documents.filter((d) => d.status === "uploaded").length;
  const na = documents.filter((d) => d.status === "na").length;
  const rejected = documents.filter((d) => d.status === "rejected").length;
  const missing = documents.filter((d) => d.status === "missing" || d.status === "rejected").length;
  return { total, accepted, uploaded, na, rejected, missing, done: total - missing };
}

/** Dokumenty „co jeszcze brakuje” — wrzucanie zdjęcia albo PDF z podglądem przed wysłaniem. */
export default function PortalDocuments({
  token,
  documents,
  agentFirst,
  canUpload,
  onChanged,
  embedded,
}: {
  token: string;
  documents: PortalDocument[];
  summary?: PortalDocumentsSummary | null;
  agentFirst: string;
  canUpload: boolean;
  onChanged: () => void;
  /** w grupie zwijanej — bez własnej karty i nagłówka sekcji */
  embedded?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<PortalDocument | null>(null);
  const [preview, setPreview] = useState<PortalDocument | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  if (!documents.length) return null;

  const pick = (doc: PortalDocument) => {
    setTarget(doc);
    setError("");
    inputRef.current?.click();
  };

  const setNotApplicable = async (doc: PortalDocument, notApplicable: boolean) => {
    setBusyKey(doc.key);
    setError("");
    try {
      const res = await fetch(`/api/crm/client-portal/${encodeURIComponent(token)}/documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: doc.key, notApplicable }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || `Serwer odpowiedział błędem ${res.status}. Spróbuj ponownie.`));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać — sprawdź połączenie z internetem.");
    } finally {
      setBusyKey(null);
    }
  };

  const s = computeDocumentsSummary(documents);
  const pct = (n: number) => `${s.total ? (n / s.total) * 100 : 0}%`;

  const body = (
    <>
      {!embedded ? <p className="lux-kicker">Dokumenty</p> : null}
      <h2 className={`lux-serif ${embedded ? "" : "mt-1.5"} text-[22px] font-medium`}>
        {s.missing ? `Brakuje ${s.missing} z ${s.total}` : `Komplet — ${s.total} z ${s.total}`}
      </h2>
      <p className="mt-0.5 text-[12px] font-semibold text-[var(--lux-ink-3)]">
        {[
          s.accepted ? `${s.accepted} gotowe` : null,
          s.uploaded ? `${s.uploaded} u agenta do sprawdzenia` : null,
          s.rejected ? `${s.rejected} do poprawy` : null,
          s.na ? `${s.na} nie dotyczy` : null,
        ]
          .filter(Boolean)
          .join(" · ") || `${s.total} ${plDocs(s.total)} na liście`}
      </p>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--lux-well)]" aria-hidden>
        <motion.div className="h-full bg-[#2F9E6A]" initial={false} animate={{ width: pct(s.accepted) }} />
        <motion.div className="h-full bg-[#E3B45A]" initial={false} animate={{ width: pct(s.uploaded) }} />
        <motion.div className="h-full bg-[var(--lux-line-strong)]" initial={false} animate={{ width: pct(s.na) }} />
      </div>
      <p className="mt-2 text-[13px] text-[var(--lux-ink-2)]">
        Wystarczy zdjęcie telefonem albo PDF (do {formatBytes(PORTAL_UPLOAD_MAX_BYTES)}). Przed wysłaniem zobaczysz podgląd. {agentFirst} sprawdzi każdy dokument i da znać, jeśli coś trzeba poprawić.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={PORTAL_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0] || null;
          e.target.value = "";
          if (picked) setFile(picked);
        }}
      />
      <ul className="mt-2 divide-y divide-[var(--lux-line)]">
        <AnimatePresence initial={false}>
          {documents.map((doc) => {
            const st = STATUS[doc.status] || STATUS.missing;
            const canSend = canUpload && doc.status !== "accepted" && doc.status !== "na";
            return (
              <motion.li
                key={doc.key}
                id={`portal-doc-${doc.key}`}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="scroll-mt-28 py-3"
              >
                <div className="flex items-start gap-3">
                  <st.Icon className={`mt-0.5 size-5 shrink-0 ${st.tone}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-semibold ${doc.status === "na" ? "text-[var(--lux-ink-3)] line-through decoration-[var(--lux-line-strong)]" : ""}`}>
                      {doc.label}
                      {!doc.required ? <span className="font-normal text-[var(--lux-ink-3)] no-underline"> · jeśli dotyczy</span> : null}
                    </p>
                    {doc.hint ? <p className="mt-0.5 text-[12px] leading-snug text-[var(--lux-ink-3)]">{doc.hint}</p> : null}
                    <p className={`mt-1 text-[12px] font-bold ${st.tone}`}>{st.label}</p>
                    {doc.status === "rejected" && doc.note ? (
                      <p className="mt-0.5 rounded-lg bg-[var(--lux-danger-soft)] px-2 py-1 text-[12px] text-[var(--lux-danger)]">{agentFirst}: {doc.note}</p>
                    ) : null}
                    {doc.fileUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreview(doc)}
                        className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--lux-well)] px-3 py-1 text-[12px] font-semibold text-[var(--lux-accent)]"
                      >
                        <Eye className="size-3.5 shrink-0" />
                        <span className="truncate">{doc.fileName || "Zobacz plik"}</span>
                      </button>
                    ) : null}
                    {canUpload && !doc.required && (doc.status === "missing" || doc.status === "na") ? (
                      <button
                        type="button"
                        disabled={busyKey === doc.key}
                        onClick={() => void setNotApplicable(doc, doc.status !== "na")}
                        className="mt-1.5 block text-[12px] font-semibold text-[var(--lux-ink-3)] underline decoration-[var(--lux-line-strong)] underline-offset-2 disabled:opacity-40"
                      >
                        {doc.status === "na" ? "Jednak dotyczy — dodam plik" : "Nie dotyczy mnie"}
                      </button>
                    ) : null}
                  </div>
                  {canSend ? (
                    <button
                      type="button"
                      onClick={() => pick(doc)}
                      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold ${
                        doc.status === "missing" || doc.status === "rejected"
                          ? "bg-[var(--lux-solid)] text-[var(--lux-solid-ink)]"
                          : "border border-[var(--lux-line)] bg-[var(--lux-card)] text-[var(--lux-ink)]"
                      }`}
                      aria-label={`${doc.status === "missing" ? "Dodaj" : "Wymień"}: ${doc.label}`}
                    >
                      {doc.status === "missing" ? <Plus className="size-4" /> : <RefreshCw className="size-3.5" />}
                      {doc.status === "missing" ? "Dodaj" : doc.status === "rejected" ? "Popraw" : "Wymień"}
                    </button>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {error ? <p className="mt-2 text-[13px] font-semibold text-[var(--lux-danger)]">{error}</p> : null}

      <PortalUploadSheet
        key={file ? `${file.name}:${file.size}:${file.lastModified}` : "none"}
        file={file}
        targetLabel={target?.label || "Dokument"}
        targetHint={target?.hint}
        agentFirst={agentFirst}
        url={`/api/crm/client-portal/${encodeURIComponent(token)}/documents`}
        buildForm={(f) => {
          const form = new FormData();
          form.append("itemKey", target?.key || "");
          form.append("file", f);
          return form;
        }}
        onPickAnother={() => inputRef.current?.click()}
        onClose={() => setFile(null)}
        onUploaded={() => {
          setFile(null);
          onChanged();
          if (target) {
            window.setTimeout(() => {
              document.getElementById(`portal-doc-${target.key}`)?.classList.add("eos-flash");
            }, 250);
          }
        }}
      />

      <LuxSheet open={Boolean(preview)} onClose={() => setPreview(null)} kicker="Wysłany plik" title={preview?.label}>
        {preview?.fileUrl ? (
          <div className="space-y-3">
            <PortalFilePreview src={preview.fileUrl} name={preview.fileName || preview.label} mimeType={preview.mimeType} height={460} />
            <div className="flex items-center justify-between gap-3 text-[12px] text-[var(--lux-ink-3)]">
              <span className="truncate">
                {preview.fileName}
                {preview.uploadedAt ? ` · ${new Date(preview.uploadedAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
              <a href={preview.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-[var(--lux-accent)]">
                {fileKind({ name: preview.fileName || "", type: preview.mimeType || "" }) === "other" ? "Pobierz" : "Otwórz w nowej karcie"}
              </a>
            </div>
          </div>
        ) : null}
      </LuxSheet>
    </>
  );

  return embedded ? (
    <div id="portal-documents" className="scroll-mt-24">{body}</div>
  ) : (
    <section id="portal-documents" className="lux-card scroll-mt-24 p-5">
      {body}
    </section>
  );
}
