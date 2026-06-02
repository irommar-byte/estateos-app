"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Save } from "lucide-react";
import EosModal from "@/components/ui/EosModal";

type Props = {
  open: boolean;
  offerId: number | null;
  offerTitle?: string;
  onClose: () => void;
};

type ApiNote = {
  userNote: string;
  importSource: string | null;
  importExternalUrl: string | null;
  importExternalId: string | null;
  importSnapshotJson: string | null;
  sourceIsActive: boolean | null;
  sourceLastCheckAt: string | null;
  sourceLastHttpStatus: number | null;
  sourceLastError: string | null;
};

export default function OfferPrivateCommentModal({ open, offerId, offerTitle, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState<ApiNote | null>(null);
  const [userNote, setUserNote] = useState("");

  const parsedSnapshot = useMemo(() => {
    if (!note?.importSnapshotJson) return null;
    try {
      return JSON.parse(note.importSnapshotJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [note?.importSnapshotJson]);

  useEffect(() => {
    if (!open || !offerId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setNote(null);
    void fetch(`/api/offers/${offerId}/private-note`, { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data?.error || `Błąd ${res.status}`));
        return data?.note as ApiNote;
      })
      .then((row) => {
        if (cancelled) return;
        setNote(row);
        setUserNote(String(row?.userNote || ""));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Nie udało się pobrać komentarza.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, offerId]);

  const save = async () => {
    if (!offerId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/offers/${offerId}/private-note`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || `Błąd ${res.status}`));
      setNote((prev) => (prev ? { ...prev, userNote: String(data?.note?.userNote || userNote) } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać komentarza.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <EosModal
      open={open}
      onClose={onClose}
      title={offerTitle ? `Komentarz · ${offerTitle}` : "Komentarz oferty"}
      badge="Prywatne notatki właściciela"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-6 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-emerald-500" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>
        ) : null}

        {!loading ? (
          <>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                Twój komentarz (widoczny tylko dla Ciebie)
              </p>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Dodaj prywatne notatki o tej nieruchomości, ustalenia, follow-up, kontakt..."
                className="w-full min-h-[140px] rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-3 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/40"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Zapisz komentarz
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-blue-300">Oryginalne dane z importu</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/15 px-3 py-1 bg-black/25 text-white/80">
                  Źródło: {note?.importSource || "brak"}
                </span>
                {note?.sourceIsActive === false ? (
                  <span className="rounded-full border border-red-500/30 px-3 py-1 bg-red-500/10 text-red-400 inline-flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Oferta źródłowa prawdopodobnie wygasła
                  </span>
                ) : note?.sourceIsActive === true ? (
                  <span className="rounded-full border border-emerald-500/30 px-3 py-1 bg-emerald-500/10 text-emerald-400">
                    Link źródłowy aktywny
                  </span>
                ) : (
                  <span className="rounded-full border border-white/15 px-3 py-1 bg-black/25 text-white/70">
                    Status linku: niezweryfikowany
                  </span>
                )}
              </div>

              {note?.importExternalUrl ? (
                <a
                  href={note.importExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-blue-300 hover:text-blue-200"
                >
                  Otwórz oryginalną ofertę <ExternalLink size={12} />
                </a>
              ) : null}

              {parsedSnapshot?.contactHints ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                  <p className="font-black uppercase tracking-widest text-[10px] text-white/55 mb-2">Kontakt źródłowy</p>
                  <p>Firma / osoba: {String((parsedSnapshot.contactHints as Record<string, unknown>)?.agencyName || "—")}</p>
                  <p>Telefon: {String((parsedSnapshot.contactHints as Record<string, unknown>)?.phone || "—")}</p>
                  <p>Adres: {String((parsedSnapshot.contactHints as Record<string, unknown>)?.address || "—")}</p>
                </div>
              ) : null}

              {parsedSnapshot?.descriptionOriginalText ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-black uppercase tracking-widest text-[10px] text-white/55 mb-2">
                    Oryginalny opis (bez zmian)
                  </p>
                  <p className="text-xs text-white/80 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {String(parsedSnapshot.descriptionOriginalText)}
                  </p>
                </div>
              ) : null}

              <details className="rounded-xl border border-white/10 bg-black/20 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-white/60">
                  Pełny surowy JSON importu
                </summary>
                <pre className="mt-3 text-[11px] text-emerald-300/90 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                  {note?.importSnapshotJson || "{}"}
                </pre>
              </details>
            </div>
          </>
        ) : null}
      </div>
    </EosModal>
  );
}
