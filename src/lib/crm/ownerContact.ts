/** Kontakt do właściciela oferty z notatki prywatnej (import KEI / portal + notatka agenta). Bez zależności od bazy. */

export type TodayOwnerContact = {
  phone: string | null;
  directOwner: boolean;
  note: string | null;
  sourceUrl: string | null;
};

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

const PHONE_RE = /(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/;

export function extractOwnerContact(row: {
  userNote?: string | null;
  importSnapshotJson?: string | null;
  importExternalUrl?: string | null;
} | null): TodayOwnerContact | null {
  if (!row) return null;
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = record(JSON.parse(String(row.importSnapshotJson || '{}')));
  } catch {
    snapshot = {};
  }
  const contact = record(snapshot.contact);
  const hints = record(snapshot.contactHints);
  const note = String(row.userNote || '').trim();
  const fromNote = note.match(PHONE_RE)?.[0] || null;
  const phone =
    String(contact.keiPhone || contact.phone || hints.phone || '').trim() || (fromNote ? fromNote.trim() : '') || null;
  if (!phone && !note) return null;
  return {
    phone,
    directOwner: Boolean(contact.directOwner),
    note: note ? note.slice(0, 280) : null,
    sourceUrl: row.importExternalUrl || null,
  };
}

