"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Phone, Save } from "lucide-react";
import EosModal from "@/components/ui/EosModal";
import { shapeOfferPrivateNoteView } from "@/lib/offerPrivateNoteView";

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

function phoneHref(raw: string | null): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `tel:+48${digits.length === 9 ? digits : digits.replace(/^48/, "")}`;
}

export default function OfferPrivateCommentModal({ open, offerId, offerTitle, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState<ApiNote | null>(null);
  const [userNote, setUserNote] = useState("");

  const view = useMemo(() => shapeOfferPrivateNoteView(note?.importSnapshotJson), [note?.importSnapshotJson]);
  const callHref = phoneHref(view.phone);

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

  const sourceLive = note?.sourceIsActive === true;
  const sourceDead = note?.sourceIsActive === false;

  return (
    <EosModal
      open={open}
      onClose={onClose}
      title={offerTitle ? `Notatka · ${offerTitle}` : "Notatka oferty"}
      badge="Prywatne — tylko agent"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="eos-inset-well flex items-center justify-center rounded-2xl p-6">
            <Loader2 size={18} className="animate-spin text-emerald-500" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>
        ) : null}

        {!loading ? (
          <>
            <div className="eos-inset-frame rounded-[1.4rem] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`eos-source-seal ${sourceDead ? "eos-source-seal--dead" : ""}`}
                  title={sourceLive ? "Źródło aktywne" : sourceDead ? "Źródło nieaktywne" : "Nie sprawdzone"}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--eos-subtle)]">
                    Jakość źródła
                  </p>
                  <p className="text-sm font-bold text-[var(--eos-text)]">
                    {sourceLive
                      ? "Aktywne na portalu"
                      : sourceDead
                        ? "Prawdopodobnie wygasło / wycofane"
                        : "Jeszcze nie sprawdzone"}
                  </p>
                  {note?.sourceLastCheckAt ? (
                    <p className="text-[11px] text-[var(--eos-muted)]">
                      Sprawdzone {new Date(note.sourceLastCheckAt).toLocaleString("pl-PL")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="eos-inset-well rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-subtle)]">Kontakt</p>
                <p className="text-sm text-[var(--eos-text)]">
                  Telefon KEI: <span className="font-bold">{view.keiPhone || "—"}</span>
                </p>
                <p className="text-sm text-[var(--eos-text)]">
                  Telefon z portalu: <span className="font-bold">{view.portalPhone || "—"}</span>
                </p>
                <p className="text-sm text-[var(--eos-text)]">
                  Osoba / biuro: <span className="font-bold">{view.agencyName || "—"}</span>
                </p>
                <p className="text-sm text-[var(--eos-muted)]">
                  {view.directOwner ? "Bez pośredników (KEI)" : view.advertiserType || "Typ ogłoszeniodawcy nieznany"}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {callHref ? (
                    <a href={callHref} className="eos-engraved-cta eos-engraved-cta--home">
                      <Phone size={14} />
                      Zadzwoń
                    </a>
                  ) : null}
                  {note?.importExternalUrl ? (
                    <a
                      href={note.importExternalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="eos-engraved-cta"
                    >
                      <ExternalLink size={14} />
                      Otwórz źródło
                    </a>
                  ) : null}
                </div>
              </section>

              <section className="eos-inset-well rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-subtle)]">Źródło KEI</p>
                <p className="text-sm text-[var(--eos-text)]">ID: <span className="font-bold">{view.keiId || "—"}</span></p>
                <p className="text-sm text-[var(--eos-text)]">Adres: <span className="font-bold">{view.keiAddress || view.contactAddress || "—"}</span></p>
                <p className="text-sm text-[var(--eos-text)]">
                  {[view.keiDistrict, view.keiStreet, view.keiRooms ? `${view.keiRooms} pok.` : null]
                    .filter(Boolean)
                    .join(" · ") || "Brak dodatkowych danych KEI"}
                </p>
                <p className="text-[11px] text-[var(--eos-muted)]">
                  {view.keiListedAt ? `W KEI od ${view.keiListedAt}` : "Data KEI nieznana"}
                  {view.keiPricePerSqm ? ` · ${Math.round(view.keiPricePerSqm).toLocaleString("pl-PL")} zł/m²` : ""}
                </p>
              </section>
            </div>

            <section className="eos-inset-well rounded-2xl p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-subtle)]">Portal</p>
              <p className="text-sm font-bold text-[var(--eos-text)]">{note?.importSource || "brak"} · {view.titleOriginal || offerTitle || "—"}</p>
              {view.descriptionOriginalText ? (
                <p className="max-h-36 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--eos-muted)]">
                  {view.descriptionOriginalText}
                </p>
              ) : (
                <p className="text-xs text-[var(--eos-muted)]">Brak oryginalnego opisu — oferta sprzed archiwum importu.</p>
              )}
            </section>

            <section className="eos-inset-frame rounded-[1.4rem] p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-subtle)]">
                Twoje notatki
              </p>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Ustalenia, follow-up, kto odbiera, kiedy dzwonić…"
                className="eos-field-inset w-full min-h-[140px] rounded-xl p-3 text-sm text-[var(--eos-text)] outline-none"
              />
              <div className="flex justify-end">
                <button type="button" onClick={() => void save()} disabled={saving} className="eos-engraved-cta eos-engraved-cta--home">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Zapisz notatkę
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </EosModal>
  );
}
