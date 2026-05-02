/**
 * Wspólne parsowanie zdarzeń dealroomu — spójne z DealroomChatScreen.
 */

export const EVENT_PREFIX = '[[DEAL_EVENT]]';

const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

export const parseJsonMaybe = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const parseIntMaybe = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const parseCurrencyMaybe = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const n = Number(normalized);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const intOnly = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(intOnly) && intOnly > 0 ? intOnly : null;
};

export const parseLegacyPolishDate = (rawDate: string) => {
  const trimmed = rawDate.trim();
  const dotMatch = trimmed.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s*(?:o|godz\.?)?\s*(\d{1,2})[:.](\d{2}))?/i);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const yearRaw = Number(dotMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const hour = Number(dotMatch[4] ?? 0);
    const minute = Number(dotMatch[5] ?? 0);
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  const fallback = new Date(trimmed.replace(' o ', ' ').replace(/\./g, '-'));
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

export function parseDealEvent(input?: string | any) {
  const rawMessage = typeof input === 'string' ? null : input;
  const content = typeof input === 'string' ? input : String(input?.content || '');
  if (!content && !rawMessage) return null;

  const payloadFromMessage = {
    ...parseJsonMaybe(rawMessage?.payload),
    ...parseJsonMaybe(rawMessage?.eventPayload),
    ...parseJsonMaybe(rawMessage?.meta),
    ...parseJsonMaybe(rawMessage?.metadata),
    ...parseJsonMaybe(rawMessage?.data),
    ...(rawMessage?.event && typeof rawMessage.event === 'object' ? rawMessage.event : {}),
    ...(rawMessage?.dealEvent && typeof rawMessage.dealEvent === 'object' ? rawMessage.dealEvent : {}),
  };

  const messageRefs = {
    bidId: parseIntMaybe(firstDefined(rawMessage?.bidId, rawMessage?.bid?.id, payloadFromMessage.bidId, payloadFromMessage.bid?.id, payloadFromMessage.id)),
    appointmentId: parseIntMaybe(firstDefined(rawMessage?.appointmentId, rawMessage?.appointment?.id, payloadFromMessage.appointmentId, payloadFromMessage.appointment?.id, payloadFromMessage.id)),
    note: String(firstDefined(rawMessage?.note, payloadFromMessage.note, payloadFromMessage.message) || '').trim(),
  };

  if (!content) return null;
  if (content.startsWith(EVENT_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(EVENT_PREFIX.length));
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          bidId: parsed.bidId ?? messageRefs.bidId ?? null,
          appointmentId: parsed.appointmentId ?? messageRefs.appointmentId ?? null,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  const appointmentLegacyMatch =
    content.match(/(?:zaproponowano|nowy)\s+termin(?:\s+spotkania)?[:\s-]*(.+)$/i) ||
    content.match(/termin(?:\s+spotkania)?[:\s-]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}(?:\s*(?:o|godz\.?)?\s*\d{1,2}[:.]\d{2})?)/i);
  if (appointmentLegacyMatch) {
    const raw = String(appointmentLegacyMatch[1] || '').trim();
    const proposedDate = raw ? parseLegacyPolishDate(raw) : null;
    return {
      entity: 'APPOINTMENT',
      action: 'PROPOSED',
      appointmentId: messageRefs.appointmentId,
      proposedDate,
      note: messageRefs.note || 'Wiadomość z wcześniejszego formatu',
      status: 'PENDING',
      legacy: true,
    };
  }

  const upper = content.toUpperCase();
  const isBidMessage =
    /(?:cena|oferta cenowa|propozycja cenowa|kontroferta|counteroffer)/i.test(content) ||
    (upper.includes('BID') && /\d/.test(content));

  if (isBidMessage) {
    const amountFromText =
      parseCurrencyMaybe(content.match(/(?:za|na|:)\s*([\d\s.,]+)\s*(?:PLN|ZŁ)?/i)?.[1]) ||
      parseCurrencyMaybe(content.match(/([\d\s.,]+)\s*(?:PLN|ZŁ)\b/i)?.[1]);
    const amount = amountFromText ?? parseIntMaybe(firstDefined(rawMessage?.amount, payloadFromMessage.amount));
    let action: 'PROPOSED' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' = 'PROPOSED';
    if (/kontrofert|counter/i.test(content)) action = 'COUNTERED';
    if (/zaakceptowan|accepted/i.test(content)) action = 'ACCEPTED';
    if (/odrzucon|reject|declin/i.test(content)) action = 'REJECTED';

    return {
      entity: 'BID',
      action,
      bidId: messageRefs.bidId,
      amount: amount || 0,
      note: messageRefs.note || 'Wiadomość z wcześniejszego formatu',
      status: action === 'ACCEPTED' ? 'ACCEPTED' : action === 'REJECTED' ? 'REJECTED' : 'PENDING',
      legacy: true,
    };
  }

  return null;
}

export function normalizeDealEvent(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const entity = String(raw.entity || '').toUpperCase();
  const action = String(raw.action || '').toUpperCase();
  const status = String(raw.status || '').toUpperCase();
  const amount = parseCurrencyMaybe(raw.amount) || 0;
  const appointmentId = parseIntMaybe(raw.appointmentId);
  const bidId = parseIntMaybe(raw.bidId);

  let proposedDate: string | null = null;
  if (raw.proposedDate) {
    const parsed = new Date(raw.proposedDate);
    if (!Number.isNaN(parsed.getTime())) proposedDate = parsed.toISOString();
  } else if (raw.date) {
    const parsed = new Date(raw.date);
    if (!Number.isNaN(parsed.getTime())) proposedDate = parsed.toISOString();
  }

  return {
    ...raw,
    entity,
    action,
    status,
    amount,
    appointmentId,
    bidId,
    proposedDate,
  };
}
