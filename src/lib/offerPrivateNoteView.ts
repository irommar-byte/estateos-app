export type PrivateNoteView = {
  keiPhone: string | null;
  portalPhone: string | null;
  phone: string | null;
  agencyName: string | null;
  contactAddress: string | null;
  advertiserType: string | null;
  directOwner: boolean;
  keiId: string | null;
  keiAddress: string | null;
  keiDistrict: string | null;
  keiStreet: string | null;
  keiRooms: number | null;
  keiPricePerSqm: number | null;
  keiListedAt: string | null;
  keiText: string | null;
  titleOriginal: string | null;
  descriptionOriginalText: string | null;
};

export function shapeOfferPrivateNoteView(snapshotJson: string | null | undefined): PrivateNoteView {
  let parsed: Record<string, unknown> = {};
  if (snapshotJson) {
    try {
      parsed = JSON.parse(snapshotJson) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  const contact = (parsed.contact || parsed.contactHints || {}) as Record<string, unknown>;
  const kei = (parsed.kei || {}) as Record<string, unknown>;
  const roomsRaw = kei.rooms;
  const rooms = typeof roomsRaw === 'number' ? roomsRaw : Number(roomsRaw);
  return {
    keiPhone: String(kei.phone || contact.keiPhone || '').trim() || null,
    portalPhone: String(contact.portalPhone || '').trim() || null,
    phone: String(contact.phone || kei.phone || '').trim() || null,
    agencyName: String(contact.agencyName || '').trim() || null,
    contactAddress: String(contact.address || kei.address || '').trim() || null,
    advertiserType: String(contact.advertiserType || '').trim() || null,
    directOwner: Boolean(kei.directOwner || contact.directOwner),
    keiId: String(kei.id || '').trim() || null,
    keiAddress: String(kei.address || '').trim() || null,
    keiDistrict: String(kei.district || '').trim() || null,
    keiStreet: String(kei.street || '').trim() || null,
    keiRooms: Number.isFinite(rooms) && rooms > 0 ? rooms : null,
    keiPricePerSqm: Number.isFinite(Number(kei.pricePerSqm)) ? Number(kei.pricePerSqm) : null,
    keiListedAt: String(kei.listedAt || '').trim() || null,
    keiText: String(kei.textExcerpt || '').trim() || null,
    titleOriginal: String(parsed.titleOriginal || '').trim() || null,
    descriptionOriginalText: String(parsed.descriptionOriginalText || '').trim() || null,
  };
}
