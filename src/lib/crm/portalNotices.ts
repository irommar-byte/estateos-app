/**
 * Powiadomienia panelu klienta (dzwonek). Budowane z aktualnego stanu panelu — każde ma stabilne id,
 * więc „przeczytane” zapamiętujemy w przeglądarce i nowa rzecz (nowe id) zawsze wraca jako nowa.
 */

export type PortalNoticeGroup = 'journey' | 'offers' | 'sale' | 'listing' | 'agreement' | 'documents' | 'chat';

export type PortalNotice = {
  id: string;
  group: PortalNoticeGroup;
  /** id elementu na stronie, do którego przewijamy po kliknięciu */
  anchor: string;
  title: string;
  body?: string | null;
  at: string | null;
  /** action = trzeba coś zrobić; info = do wiadomości */
  tone: 'action' | 'info';
  matchId?: number;
};

export const NOTICE_GROUP_LABEL: Record<PortalNoticeGroup, string> = {
  journey: 'Twoja droga',
  offers: 'Propozycje',
  sale: 'Sprzedaż',
  listing: 'Ogłoszenie',
  agreement: 'Umowa',
  documents: 'Dokumenty',
  chat: 'Rozmowa',
};

type NoticeInput = {
  type: 'BUYER' | 'SELLER';
  isPartner: boolean;
  agentFirst: string;
  documents: Array<{
    key: string;
    label: string;
    hint: string | null;
    custom?: boolean;
    status: string;
    note: string | null;
    reviewedAt?: string | null;
    createdAt?: string | null;
  }>;
  matches: Array<{ id: number; notifiedAt: string | null; clientFeedback: string | null; offer: { title: string; city?: string | null; district?: string | null } }>;
  agentReplies: Array<{ matchId: number; offerTitle: string; agentReply: string; agentReplyAt: string | null; unread: boolean }>;
  checkback: { activityId: number; body: string; createdAt?: string } | null;
  presentation: { startsAt: string; status: string; proposedBy: string } | null;
  meeting: { startsAt: string; status: string; proposedBy: string } | null;
  buyerOffers: Array<{ id: number; buyerLabel: string; amount: number; status: string; clientResponse: string | null }>;
  decisions: Array<{ id: number; title: string; clientMessage: string; clientResponse?: string | null; dueAt: string | null }>;
  agreement: { pending: boolean; updatedAt: string | null } | null;
  chat: { unread: number; latestAgentId: string | null; latestAt: string | null; preview: string | null };
};

const RECENT_MS = 30 * 86_400_000;
const pln = (n: number) => `${Math.round(n).toLocaleString('pl-PL')} zł`;

export function buildPortalNotices(input: NoticeInput): PortalNotice[] {
  const out: PortalNotice[] = [];
  const now = Date.now();

  if (input.chat.unread > 0) {
    out.push({
      id: `chat:${input.chat.latestAgentId || input.chat.unread}`,
      group: 'chat',
      anchor: 'portal-chat',
      title: `${input.chat.unread === 1 ? 'Nowa wiadomość' : `${input.chat.unread} nowe wiadomości`} od ${input.agentFirst}`,
      body: input.chat.preview,
      at: input.chat.latestAt,
      tone: 'action',
    });
  }

  if (input.checkback) {
    out.push({
      id: `checkback:${input.checkback.activityId}`,
      group: 'journey',
      anchor: 'portal-journey',
      title: `${input.agentFirst} prosi o krótką odpowiedź`,
      body: input.checkback.body,
      at: input.checkback.createdAt || null,
      tone: 'action',
    });
  }

  for (const slot of [
    { s: input.presentation, label: input.type === 'BUYER' ? 'oglądania' : 'prezentacji', anchor: 'portal-presentation' },
    { s: input.meeting, label: 'spotkania', anchor: 'portal-meeting' },
  ]) {
    if (!slot.s || slot.s.status === 'confirmed') continue;
    if (new Date(slot.s.startsAt).getTime() < now) continue;
    out.push({
      id: `slot:${slot.anchor}:${slot.s.startsAt}`,
      group: input.type === 'BUYER' ? 'journey' : 'sale',
      anchor: slot.anchor,
      title: slot.s.proposedBy === 'client' ? `Czekamy, aż ${input.agentFirst} potwierdzi termin ${slot.label}` : `Potwierdź termin ${slot.label}`,
      body: new Date(slot.s.startsAt).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
      at: null,
      tone: slot.s.proposedBy === 'client' ? 'info' : 'action',
    });
  }

  if (input.type === 'BUYER') {
    for (const m of input.matches) {
      if (m.clientFeedback) continue;
      out.push({
        id: `match:${m.id}`,
        group: 'offers',
        anchor: `portal-match-${m.id}`,
        title: `Nowa propozycja: ${m.offer.title}`,
        body: [m.offer.district, m.offer.city].filter(Boolean).join(', ') || 'Oceń ją jednym dotknięciem.',
        at: m.notifiedAt,
        tone: 'action',
        matchId: m.id,
      });
    }
    for (const r of input.agentReplies) {
      if (!r.unread) continue;
      out.push({
        id: `reply:${r.matchId}:${r.agentReplyAt || ''}`,
        group: 'offers',
        anchor: 'portal-replies',
        title: `${input.agentFirst} odpowiedział: ${r.offerTitle}`,
        body: r.agentReply,
        at: r.agentReplyAt,
        tone: 'action',
        matchId: r.matchId,
      });
    }
  }

  if (input.type === 'SELLER') {
    for (const o of input.buyerOffers) {
      if (o.status !== 'OPEN' || o.clientResponse) continue;
      out.push({
        id: `boffer:${o.id}`,
        group: 'sale',
        anchor: 'portal-buyer-offers',
        title: `Oferta kupującego: ${pln(o.amount)}`,
        body: `${o.buyerLabel} — zobacz rekomendację ${input.agentFirst} i odpowiedz.`,
        at: null,
        tone: 'action',
      });
    }
    for (const d of input.decisions) {
      if (d.clientResponse) continue;
      out.push({
        id: `decision:${d.id}`,
        group: 'sale',
        anchor: 'portal-decisions',
        title: d.title,
        body: d.clientMessage,
        at: d.dueAt,
        tone: 'action',
      });
    }
    if (input.agreement?.pending) {
      out.push({
        id: `agreement:${input.agreement.updatedAt || ''}`,
        group: 'agreement',
        anchor: 'portal-agreement',
        title: 'Umowa czeka na Twój podpis',
        body: 'Przeczytaj warunki współpracy w panelu.',
        at: input.agreement.updatedAt,
        tone: 'action',
      });
    }
  }

  if (!input.isPartner) {
    for (const d of input.documents) {
      if (d.status === 'rejected') {
        out.push({
          id: `doc-rej:${d.key}:${d.reviewedAt || ''}`,
          group: 'documents',
          anchor: `portal-doc-${d.key}`,
          title: `Dokument do poprawy: ${d.label}`,
          body: d.note || `${input.agentFirst} prosi o nowy plik.`,
          at: d.reviewedAt || null,
          tone: 'action',
        });
      } else if (d.status === 'accepted' && d.reviewedAt && now - new Date(d.reviewedAt).getTime() < RECENT_MS) {
        out.push({
          id: `doc-ok:${d.key}:${d.reviewedAt}`,
          group: 'documents',
          anchor: `portal-doc-${d.key}`,
          title: `Zaakceptowano: ${d.label}`,
          body: `${input.agentFirst} sprawdził dokument — nic więcej nie trzeba.`,
          at: d.reviewedAt,
          tone: 'info',
        });
      } else if (d.status === 'missing' && d.custom && d.createdAt && now - new Date(d.createdAt).getTime() < RECENT_MS) {
        out.push({
          id: `doc-new:${d.key}`,
          group: 'documents',
          anchor: `portal-doc-${d.key}`,
          title: `${input.agentFirst} dodał do listy: ${d.label}`,
          body: d.hint || 'Nowy dokument do przesłania.',
          at: d.createdAt,
          tone: 'action',
        });
      }
    }
  }

  return out.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'action' ? -1 : 1;
    return String(b.at || '').localeCompare(String(a.at || ''));
  });
}
