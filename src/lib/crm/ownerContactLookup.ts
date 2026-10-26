import { prisma } from '@/lib/prisma';
import { getOfferPrivateNote } from '@/lib/offerPrivateNotes';
import { extractOwnerContact, normalizePolishPhone, type TodayOwnerContact } from '@/lib/crm/ownerContact';
import { findKeiListingsByIdsOrUrls, type KeiPropertyKind, type KeiTransactionKind } from '@/lib/keiAmerClient';
import { parseKeiPhone } from '@/lib/keiAmerListingExtras';

/**
 * Kontakt do właściciela dla agenta:
 * - oferta jego / jego biura / administrator → numer właściciela (z importu, KEI na żywo, treści, notatki),
 * - oferta innego agenta z bazy → numer tego agenta („zadzwoń do agenta prowadzącego”).
 */

type OfferRef = { id: number; userId: number; propertyType?: string | null; transactionType?: string | null };

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function companyIdOf(userId: number): Promise<number | null> {
  const [owned, member] = await Promise.all([
    prisma.agencyCompany.findUnique({ where: { ownerUserId: userId }, select: { id: true } }).catch(() => null),
    prisma.agencyCompanyMember
      .findUnique({ where: { userId }, select: { companyId: true, status: true } })
      .catch(() => null),
  ]);
  if (owned) return owned.id;
  if (member && String(member.status) === 'ACTIVE') return member.companyId;
  return null;
}

/** Czy agent może widzieć prywatne dane oferty (właściciel, to samo biuro, administrator). */
export async function canSeeOfferOwner(viewerId: number, offerUserId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin || viewerId === offerUserId) return true;
  const [a, b] = await Promise.all([companyIdOf(viewerId), companyIdOf(offerUserId)]);
  return a != null && a === b;
}

async function patchSnapshotContact(offerId: number, userId: number, patch: Record<string, unknown>): Promise<void> {
  const row = await getOfferPrivateNote(offerId, userId);
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = record(JSON.parse(String(row?.importSnapshotJson || '{}')));
  } catch {
    snapshot = {};
  }
  const next = { ...snapshot, contact: { ...record(snapshot.contact), ...patch } };
  await prisma.$executeRawUnsafe(
    `INSERT INTO OfferPrivateNote (offerId, userId, userNote, importSnapshotJson)
     VALUES (?, ?, '', ?)
     ON DUPLICATE KEY UPDATE importSnapshotJson = VALUES(importSnapshotJson)`,
    offerId,
    userId,
    JSON.stringify(next),
  );
}

/** Numer dopisany ręcznie przez agenta — od teraz pierwszy na karcie. */
export async function saveAgentOwnerPhone(offer: { id: number; userId: number }, rawPhone: string): Promise<string | null> {
  const phone = normalizePolishPhone(rawPhone);
  if (!phone) return null;
  await patchSnapshotContact(offer.id, offer.userId, { agentPhone: phone, agentPhoneAt: new Date().toISOString() });
  return phone;
}

function keiKinds(offer: OfferRef): { propertyKind: KeiPropertyKind; transactionKind: KeiTransactionKind } {
  return {
    propertyKind: String(offer.propertyType || '').toUpperCase() === 'HOUSE' ? 'house' : 'apartment',
    transactionKind: String(offer.transactionType || '').toUpperCase() === 'RENT' ? 'rent' : 'sale',
  };
}

/**
 * Numer z KEI na żywo — KEI trzyma ogłoszenie z telefonem dłużej niż portal.
 * Wynik zapisujemy w notatce oferty, żeby szukać tylko raz.
 */
export async function lookupKeiOwnerPhone(offer: OfferRef, timeoutMs = 7_000): Promise<string | null> {
  const row = await getOfferPrivateNote(offer.id, offer.userId).catch(() => null);
  if (!row) return null;
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = record(JSON.parse(String(row.importSnapshotJson || '{}')));
  } catch {
    return null;
  }
  const kei = record(snapshot.kei);
  const contact = record(snapshot.contact);
  const keiId = String(kei.id || '').trim();
  const url = String(row.importExternalUrl || '').trim();
  if (!keiId && !url) return null;
  // Raz na dobę wystarczy — nie męczymy KEI przy każdym otwarciu ekranu.
  const lastTry = Date.parse(String(contact.keiLookupAt || ''));
  if (Number.isFinite(lastTry) && Date.now() - lastTry < 24 * 60 * 60 * 1000) return null;

  const search = findKeiListingsByIdsOrUrls({
    ...keiKinds(offer),
    keiIds: keiId ? [keiId] : [],
    portalUrls: url ? [url] : [],
    maxPages: 4,
  }).catch(() => []);
  const timeout = new Promise<[]>((resolve) => setTimeout(() => resolve([]), timeoutMs).unref?.());
  const rows = await Promise.race([search, timeout]);
  const found = rows[0];
  const phone = found ? normalizePolishPhone(parseKeiPhone(found.telefon)) : null;
  await patchSnapshotContact(offer.id, offer.userId, {
    keiLookupAt: new Date().toISOString(),
    ...(phone ? { keiPhone: phone, directOwner: Boolean(contact.directOwner) } : {}),
  }).catch(() => undefined);
  return phone;
}

export async function resolveOwnerContact(params: {
  offer: OfferRef;
  viewerId: number;
  isAdmin: boolean;
  allowKeiLookup?: boolean;
}): Promise<TodayOwnerContact | null> {
  const { offer } = params;
  const allowed = await canSeeOfferOwner(params.viewerId, offer.userId, params.isAdmin);
  if (!allowed) {
    const agent = await prisma.user.findUnique({
      where: { id: offer.userId },
      select: { name: true, companyName: true, phone: true, officePhone: true },
    });
    const name = String(agent?.name || agent?.companyName || 'Agent prowadzący').trim();
    return {
      phone: null,
      phoneMasked: null,
      phoneSource: null,
      directOwner: false,
      advertiser: null,
      note: null,
      sourceUrl: null,
      sourceLabel: null,
      listedAt: null,
      listingAgent: { name, phone: normalizePolishPhone(agent?.phone) || normalizePolishPhone(agent?.officePhone) || agent?.phone || null },
      canAddPhone: false,
    };
  }
  const note = await getOfferPrivateNote(offer.id, offer.userId).catch(() => null);
  let contact = extractOwnerContact(note);
  if (!contact?.phone && params.allowKeiLookup) {
    const phone = await lookupKeiOwnerPhone(offer).catch(() => null);
    if (phone) contact = extractOwnerContact(await getOfferPrivateNote(offer.id, offer.userId).catch(() => null));
  }
  return (
    contact ?? {
      phone: null,
      phoneMasked: null,
      phoneSource: null,
      directOwner: false,
      advertiser: null,
      note: null,
      sourceUrl: null,
      sourceLabel: null,
      listedAt: null,
      listingAgent: null,
      canAddPhone: true,
    }
  );
}
