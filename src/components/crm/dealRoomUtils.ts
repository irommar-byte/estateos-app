export const EVENT_PREFIX = '[[DEAL_EVENT]]';

export function normalizeEventAction(action?: string): string {
  const raw = String(action || '').toUpperCase();
  if (raw === 'ACCEPT') return 'ACCEPTED';
  if (raw === 'REJECT') return 'REJECTED';
  if (raw === 'DECLINE') return 'DECLINED';
  if (raw === 'PROPOSE') return 'PROPOSED';
  if (raw === 'COUNTER') return 'COUNTERED';
  return raw;
}

export function parseDealEvent(content?: string) {
  if (!content || !content.startsWith(EVENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(EVENT_PREFIX.length));
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      action: normalizeEventAction(parsed.action),
      status: normalizeEventAction(parsed.status),
      note: parsed.note ?? parsed.message ?? null,
    };
  } catch {
    return null;
  }
}

export type DealRoomSection = 'presentations' | 'price' | 'chat';

export type TimelineKind = 'appointment' | 'bid' | 'chat';

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  createdAt: number;
  message?: any;
  event?: any;
  record?: any;
};

function ts(value: unknown): number {
  const n = new Date(String(value || '')).getTime();
  return Number.isFinite(n) ? n : 0;
}

export function buildPresentationTimeline(deal: any): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const app of deal?.appointments || []) {
    items.push({
      id: `app-${app.id}`,
      kind: 'appointment',
      createdAt: ts(app.createdAt || app.proposedDate),
      record: app,
    });
  }
  for (const msg of deal?.messages || []) {
    const event = parseDealEvent(String(msg?.content || ''));
    if (event?.entity === 'APPOINTMENT') {
      items.push({
        id: `msg-app-${msg.id}`,
        kind: 'appointment',
        createdAt: ts(event.createdAt || msg.createdAt),
        message: msg,
        event,
      });
    }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export function buildPriceTimeline(deal: any): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const bid of deal?.bids || []) {
    items.push({
      id: `bid-${bid.id}`,
      kind: 'bid',
      createdAt: ts(bid.createdAt),
      record: bid,
    });
  }
  for (const msg of deal?.messages || []) {
    const content = String(msg?.content || '');
    const event = parseDealEvent(content);
    if (event?.entity === 'BID') {
      items.push({
        id: `msg-bid-${msg.id}`,
        kind: 'bid',
        createdAt: ts(event.createdAt || msg.createdAt),
        message: msg,
        event,
      });
      continue;
    }
    if (content.startsWith('[SYSTEM_BID:')) {
      items.push({
        id: `msg-legacy-bid-${msg.id}`,
        kind: 'bid',
        createdAt: ts(msg.createdAt),
        message: msg,
        event: { entity: 'BID', action: 'PROPOSED', amount: content.replace(/\D/g, '') },
      });
    }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export function buildChatTimeline(deal: any): any[] {
  return (deal?.messages || []).filter((msg: any) => {
    const content = String(msg?.content || '');
    if (!content || content.startsWith(EVENT_PREFIX)) return false;
    if (content.startsWith('[SYSTEM_BID:')) return false;
    return true;
  });
}

export type NegotiationEventEntry = {
  msg: any;
  event: ReturnType<typeof parseDealEvent>;
};

export function buildNegotiationEvents(deal: any): NegotiationEventEntry[] {
  const rows: NegotiationEventEntry[] = (deal?.messages || []).map((msg: any) => ({
    msg,
    event: parseDealEvent(String(msg?.content || '')),
  }));
  return rows
    .filter((entry: NegotiationEventEntry) => Boolean(entry.event?.entity))
    .sort((a, b) => {
      const ta = new Date(a.msg?.createdAt || 0).getTime();
      const tb = new Date(b.msg?.createdAt || 0).getTime();
      return ta - tb;
    });
}
