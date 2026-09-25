/**
 * Mirror of server parseOtodomLeadEmail — Numer w biurze = offerId EstateOS.
 */

export type ParsedPortalLead = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  officeOfferId: number | null;
  portalListingId: string | null;
  source: 'otodom' | 'olx' | 'other';
  rawTitle: string | null;
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (/^(\+?48)?\d{9}$/.test(digits.replace(/\s/g, ''))) {
    const nine = digits.replace(/\D/g, '').slice(-9);
    return `+48${nine}`;
  }
  if (digits.startsWith('+') && digits.length >= 10) return digits;
  return null;
}

function splitName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Klient', lastName: 'Portal' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function parseOtodomLeadEmail(raw: string): ParsedPortalLead {
  const text = String(raw || '').replace(/\r/g, '\n');
  const lower = text.toLowerCase();

  const source: ParsedPortalLead['source'] = lower.includes('otodom')
    ? 'otodom'
    : lower.includes('olx')
      ? 'olx'
      : 'other';

  const emailMatch =
    text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/) ||
    text.match(/E-?mail\s*[:：]\s*([^\s\n]+)/i);
  const email = emailMatch ? String(emailMatch[1]).trim().toLowerCase() : null;

  const phoneMatch =
    text.match(/(?:\+48[\s-]?)?(?:\d[\s-]?){9}/) ||
    text.match(/Telefon\s*[:：]\s*([+\d\s-]+)/i);
  const phone = normalizePhone(phoneMatch ? phoneMatch[0] : null);

  const nameMatch =
    text.match(/(?:^|\n)\s*([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)+)\s*(?:\n|$)/m) ||
    text.match(/Od\s*[:：]\s*([^\n<]+)/i) ||
    text.match(/Imię\s*[:：]\s*([^\n]+)/i);
  const { firstName, lastName } = splitName(nameMatch ? nameMatch[1] : 'Klient Portal');

  const officeMatch =
    text.match(/Numer\s+w\s+biurze\s*[:：]?\s*#?\s*(\d{1,8})/i) ||
    text.match(/Nr\s*(?:ref\.?|w\s+biurze)\s*[:：]?\s*#?\s*(\d{1,8})/i) ||
    text.match(/ID\s+oferty\s*(?:EstateOS)?\s*[:：]?\s*#?\s*(\d{1,8})/i);
  const officeOfferId = officeMatch ? Number(officeMatch[1]) : null;

  const portalMatch =
    text.match(/otodom\.pl\/pl\/oferta\/[^\s]*?ID(\d+)/i) ||
    text.match(/otodom\.pl\/[^\s]*?(\d{6,})/i) ||
    text.match(/ID\s*(?:ogłoszenia|portalu)?\s*[:：]?\s*(\d{6,})/i);
  let portalListingId = portalMatch ? String(portalMatch[1]) : null;
  if (portalListingId && officeOfferId && portalListingId === String(officeOfferId)) {
    portalListingId = null;
  }

  const msgMatch =
    text.match(/\[Chcę[^\]]*\]([\s\S]{10,800}?)(?:Pozdrawiam|Odpowiedz|Numer w biurze|$)/i) ||
    text.match(/(?:Wiadomość|Treść)\s*[:：]\s*([\s\S]{10,800}?)(?:\n\s*\n|Numer w biurze|Pozdrawiam|$)/i);
  const message = msgMatch ? msgMatch[1].replace(/\s+/g, ' ').trim() : null;

  const titleMatch = text.match(/Oferta\s*[:：]\s*([^\n]+)/i);
  const rawTitle = titleMatch ? titleMatch[1].trim().slice(0, 160) : null;

  return {
    firstName,
    lastName,
    email,
    phone,
    message,
    officeOfferId: Number.isFinite(officeOfferId) && (officeOfferId as number) > 0 ? officeOfferId : null,
    portalListingId,
    source,
    rawTitle,
  };
}
