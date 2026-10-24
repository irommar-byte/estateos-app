"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Circle, Clock3, Plus, RefreshCw } from "lucide-react";

export type PortalDocument = {
  key: string;
  label: string;
  hint: string | null;
  required: boolean;
  status: "missing" | "uploaded" | "accepted" | "rejected";
  fileName: string | null;
  fileUrl: string | null;
  note: string | null;
};

const STATUS = {
  missing: { label: "Brakuje", Icon: Circle, tone: "text-[#8C877D]" },
  uploaded: { label: "Wysłane — agent sprawdza", Icon: Clock3, tone: "text-[#C98A1B]" },
  accepted: { label: "Gotowe", Icon: CheckCircle2, tone: "text-[#2F9E6A]" },
  rejected: { label: "Do poprawy", Icon: AlertCircle, tone: "text-[#C2412D]" },
} as const;

/** Dokumenty „co jeszcze brakuje” — wrzucanie zdjęcia albo PDF. */
export default function PortalDocuments({
  token,
  documents,
  summary,
  agentFirst,
  canUpload,
  onChanged,
}: {
  token: string;
  documents: PortalDocument[];
  summary?: { required: number; done: number; missing: number } | null;
  agentFirst: string;
  canUpload: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const targetKey = useRef<string>("");
  if (!documents.length) return null;

  const pick = (key: string) => {
    targetKey.current = key;
    inputRef.current?.click();
  };

  const upload = async (file: File) => {
    const key = targetKey.current;
    if (!key) return;
    setBusy(key);
    setError("");
    try {
      const form = new FormData();
      form.append("itemKey", key);
      form.append("file", file);
      const res = await fetch(`/api/crm/client-portal/${encodeURIComponent(token)}/documents`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Nie udało się wysłać pliku."));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(null);
    }
  };

  const required = summary?.required ?? documents.filter((d) => d.required).length;
  const done = summary?.done ?? 0;

  return (
    <section id="portal-documents" className="lux-card scroll-mt-24 p-5">
      <p className="lux-kicker">Dokumenty</p>
      <h2 className="lux-serif mt-1.5 text-[22px] font-medium">
        {summary?.missing ? `Brakuje ${summary.missing} z ${required}` : "Komplet dokumentów"}
      </h2>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0EBE3]">
        <div className="h-full rounded-full bg-[#2F9E6A]" style={{ width: `${required ? Math.round((done / required) * 100) : 100}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-[#5B574F]">
        Wystarczy zdjęcie telefonem albo PDF. {agentFirst} sprawdzi każdy dokument i da znać, jeśli coś trzeba poprawić.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <ul className="mt-2 divide-y divide-[#E6E0D6]">
        {documents.map((doc) => {
          const st = STATUS[doc.status];
          return (
            <li key={doc.key} className="flex items-center gap-3 py-3">
              <st.Icon className={`size-5 shrink-0 ${st.tone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">
                  {doc.label}
                  {!doc.required ? <span className="font-normal text-[#8C877D]"> · jeśli dotyczy</span> : null}
                </p>
                <p className={`text-[12px] font-bold ${st.tone}`}>{st.label}</p>
                {doc.status === "rejected" && doc.note ? <p className="text-[12px] text-[#C2412D]">{doc.note}</p> : null}
                {doc.status === "missing" && doc.hint ? <p className="text-[12px] text-[#8C877D]">{doc.hint}</p> : null}
                {doc.fileUrl ? (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-[var(--lux-accent)]">
                    {doc.fileName || "Otwórz plik"}
                  </a>
                ) : null}
              </div>
              {canUpload && doc.status !== "accepted" ? (
                <button
                  type="button"
                  onClick={() => pick(doc.key)}
                  disabled={busy === doc.key}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black text-[#D8C3A0] disabled:opacity-50"
                  aria-label={`Dodaj: ${doc.label}`}
                >
                  {doc.status === "missing" ? <Plus className="size-4" /> : <RefreshCw className="size-4" />}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-[13px] font-semibold text-[#C2412D]">{error}</p> : null}
    </section>
  );
}
