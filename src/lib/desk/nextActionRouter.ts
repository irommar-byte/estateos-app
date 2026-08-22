export type DoItNowAction =
  | { type: 'section'; section: string }
  | { type: 'call'; phone: string }
  | { type: 'sms'; phone: string; body?: string }
  | { type: 'email'; email: string; subject?: string; body?: string }
  | { type: 'drawer'; title: string; src: string }
  | { type: 'outcome'; outcome: string; payload?: Record<string, unknown> }
  | { type: 'task_complete'; taskId: number }
  | { type: 'map'; query?: string; lat?: number; lng?: number }
  | { type: 'offer_inspector'; offerId: number }
  | { type: 'refresh_matches' }
  | { type: 'radar_send'; offerId: number }
  | { type: 'url'; href: string; external?: boolean };

type NbaInput = {
  id: number | null;
  title: string;
  dueAt?: string | null;
  priority?: string;
};

type CaseInput = {
  id: number;
  kind: string;
  pipelineStage: string;
  linkedOfferId?: number | null;
  client: { id: number; phone?: string | null; email?: string | null };
};

/** Map next best action text to a concrete Desk action. */
export function resolveDoItNowAction(nba: NbaInput, deskCase: CaseInput): DoItNowAction {
  const t = nba.title.toLowerCase();
  const phone = deskCase.client.phone?.trim();
  const email = deskCase.client.email?.trim();
  const offerId = deskCase.linkedOfferId;

  if (t.includes('zadzwoń') || t.includes('oddzwoń') || t.includes('brak kontaktu') || t.includes('check-in')) {
    if (phone) return { type: 'call', phone };
    return { type: 'section', section: 'CONTACT' };
  }

  if (t.includes('debrief')) {
    return { type: 'section', section: 'DEBRIEF' };
  }

  if (t.includes('dopasow') || t.includes('radar') || t.includes('hot buyer') || t.includes('obniżk')) {
    if (offerId && t.includes('radar')) return { type: 'radar_send', offerId };
    if (offerId) return { type: 'section', section: 'MATCHING' };
    return { type: 'refresh_matches' };
  }

  if (t.includes('prezentac') || t.includes('spotkanie')) {
    return { type: 'section', section: deskCase.kind === 'BUY' ? 'MATCHING' : 'CONTACT' };
  }

  if (t.includes('dokument') || t.includes('checklist') || t.includes('uzupełnij')) {
    return { type: 'section', section: deskCase.kind === 'SELL' ? 'ACQUISITION' : 'CONTACT' };
  }

  if (t.includes('deal room') || t.includes('negocjac') || t.includes('deal')) {
    return { type: 'section', section: 'DEAL' };
  }

  if (t.includes('raport') || t.includes('sprzedają') || t.includes('właściciel')) {
    return { type: 'section', section: 'REPORT' };
  }

  if (t.includes('publik') || t.includes('promuj') || t.includes('wygasa') || t.includes('marketing')) {
    return { type: 'section', section: 'LISTING' };
  }

  if (t.includes('wyślij') && t.includes('ofert')) {
    if (deskCase.kind === 'BUY') return { type: 'section', section: 'MATCHING' };
    return { type: 'section', section: 'MATCHING' };
  }

  if (t.includes('powiadom') || t.includes('obniż')) {
    if (offerId) return { type: 'radar_send', offerId };
    return { type: 'section', section: 'MATCHING' };
  }

  if (t.includes('aftercare') || t.includes('opini') || t.includes('polecen')) {
    return { type: 'section', section: 'TEMPLATES' };
  }

  if (t.includes('kwalifikac')) {
    return { type: 'section', section: 'CONTACT' };
  }

  if (t.includes('open house') || t.includes('oh')) {
    return { type: 'section', section: 'GUESTS' };
  }

  if (t.includes('umów') && phone) {
    return { type: 'call', phone };
  }

  if (email && (t.includes('wyślij') || t.includes('send'))) {
    return { type: 'email', email };
  }

  if (nba.id) {
    return { type: 'task_complete', taskId: nba.id };
  }

  if (offerId) {
    return { type: 'offer_inspector', offerId };
  }

  return { type: 'section', section: 'SUMMARY' };
}
