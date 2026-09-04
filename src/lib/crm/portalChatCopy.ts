/** Copy Live Chat: klient dostaje konkretne kroki, agent — instrukcję operacyjną. */

export type PortalChatAudience = 'client' | 'agent' | 'both';
export type PortalChatKind = 'chat' | 'client_step' | 'agent_note' | 'checkback';
export type HandoffClientKind = 'viewing' | 'detail' | 'contact';

const AGENT_LEAD_RE = /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż'’-]*\s+[—–-]\s+/;
const FEEDBACK_PREFIX_RE = /^Reakcja do oferty\s+[„"](.+?)[”"]:\s*/i;

export function parsePortalChatAudience(raw: unknown): PortalChatAudience {
  const value = String(raw || '').toLowerCase();
  if (value === 'agent' || value === 'client' || value === 'both') return value;
  return 'both';
}

export function parsePortalChatKind(raw: unknown): PortalChatKind | null {
  const value = String(raw || '').toLowerCase();
  if (value === 'chat' || value === 'client_step' || value === 'agent_note' || value === 'checkback') {
    return value;
  }
  return null;
}

export function stripAgentLead(content: string): string {
  return String(content || '').replace(AGENT_LEAD_RE, '').trim();
}

export function stripClientFeedbackPrefix(content: string): { content: string; offerTitle: string | null } {
  const raw = String(content || '').trim();
  const match = raw.match(FEEDBACK_PREFIX_RE);
  if (!match) return { content: raw, offerTitle: null };
  return {
    content: raw.slice(match[0].length).trim(),
    offerTitle: String(match[1] || '').trim() || null,
  };
}

export function looksLikeInternalHandoff(content: string): boolean {
  const text = stripAgentLead(content);
  return (
    /Klient kliknął/i.test(text) ||
    /wstrzymuję automatyczne dokładanie/i.test(text) ||
    /wybierz termin prezentacji/i.test(text) ||
    /Klient prosi o sprawdzenie/i.test(text) ||
    /przekazuję to agentowi/i.test(text)
  );
}

export function offerEvaluationNextStepsBlock(): string {
  return [
    'Co teraz zrób:',
    '1. Otwórz kartę oferty powyżej — zdjęcia i opis.',
    '2. Wybierz jedną ocenę: Chcę oglądać, Do przemyślenia albo Nie pasuje.',
    '3. Jeśli coś jest ważne, dopisz to przy ocenie (jedno zdanie wystarczy).',
  ].join('\n');
}

export function appendOfferEvaluationSteps(body: string): string {
  const text = String(body || '').trim();
  if (!text) return offerEvaluationNextStepsBlock();
  if (/Co teraz zrób:/i.test(text)) return text;
  return `${text}\n\n${offerEvaluationNextStepsBlock()}`;
}

export function wrapCheckbackQuestion(body: string): string {
  const text = String(body || '').trim();
  if (/Wybierz jedną odpowiedź poniżej/i.test(text)) return text;
  return `${text}\n\nWybierz jedną odpowiedź poniżej.`;
}

export function handoffClientKindFromReason(reason: string): HandoffClientKind {
  if (/Chcę oglądać|termin prezentacji/i.test(reason)) return 'viewing';
  if (/sprawdzenie|konkretną odpowiedź/i.test(reason)) return 'detail';
  return 'contact';
}

export function buildHandoffClientMessage(kind: HandoffClientKind): string {
  if (kind === 'viewing') {
    return [
      'Rozumiem — chcesz obejrzeć tę ofertę.',
      '',
      'Co teraz zrób:',
      '1. Agent dobierze termin pokazu.',
      '2. Dostaniesz propozycję daty tutaj i na e-mail.',
      '3. Potwierdzasz albo proponujesz inną godzinę.',
      '',
      'Na razie nie wysyłam kolejnych mieszkań — skupiamy się na tym oglądaniu.',
      'Jeśli masz konkretną datę lub godzinę, napisz ją poniżej.',
    ].join('\n');
  }
  if (kind === 'detail') {
    return [
      'Przekazałem Twoje pytanie agentowi.',
      '',
      'Co teraz zrób:',
      '1. Agent sprawdzi ten szczegół oferty.',
      '2. Odpowiedź wróci tutaj, w tym czacie.',
      '3. Ty nic więcej nie musisz teraz robić — chyba że chcesz dopisać kontekst.',
    ].join('\n');
  }
  return [
    'Przekazuję to agentowi, żebyście mogli umówić oglądanie albo rozmowę.',
    '',
    'Co teraz zrób:',
    '1. Agent skontaktuje się z propozycją terminu.',
    '2. Czekaj na wiadomość tutaj.',
    '3. Jeśli masz preferowane godziny — napisz je poniżej.',
  ].join('\n');
}

export function buildHandoffAgentNote(reason: string, agentFirstName?: string | null): string {
  const name = String(agentFirstName || '').trim();
  const lead = name ? `${name} — ` : '';
  const pause = 'Wstrzymuję automatyczne dokładanie kolejnej oferty, aż skontaktujesz się z klientem.';
  return `${lead}${String(reason || '').trim()} ${pause}`.trim();
}

export function rewriteInternalHandoffForClient(content: string): string {
  return buildHandoffClientMessage(handoffClientKindFromReason(stripAgentLead(content)));
}

export function checkbackAckForClient(params: { optionId: string; handedToAgent: boolean }): string {
  if (params.optionId === 'no') {
    return [
      'Dzięki — poprawię zrozumienie.',
      '',
      'Co teraz zrób:',
      '1. Przy następnej ofercie doprecyzuj, co zmienić.',
      '2. Albo napisz to od razu tutaj, jednym zdaniem.',
    ].join('\n');
  }
  if (params.handedToAgent) {
    return [
      'Dzięki. Agent dostał Twoją wiadomość.',
      '',
      'Co teraz zrób:',
      '1. Czekaj na odpowiedź agenta w tym czacie.',
      '2. Ja szukam dalej w ustalonych kryteriach — nic więcej nie musisz teraz robić.',
    ].join('\n');
  }
  return [
    'Dzięki — biorę to pod uwagę i szukam dalej.',
    '',
    'Co teraz zrób:',
    '1. Oceń kolejną ofertę, gdy się pojawi.',
    '2. Jeśli chcesz coś dopisać już teraz — napisz poniżej.',
  ].join('\n');
}

export type PresentedPortalChat = {
  visible: boolean;
  content: string;
  kind: PortalChatKind;
  audience: PortalChatAudience;
  offerTitle: string | null;
};

export function presentPortalChatFields(params: {
  content: string;
  fromAgent: boolean;
  viewer: 'client' | 'agent';
  audience?: unknown;
  kind?: unknown;
  offerTitle?: unknown;
}): PresentedPortalChat {
  const audience = parsePortalChatAudience(params.audience);
  if (params.viewer === 'client' && audience === 'agent') {
    return { visible: false, content: '', kind: 'agent_note', audience, offerTitle: null };
  }

  let content = String(params.content || '').trim();
  let offerTitle = String(params.offerTitle || '').trim() || null;
  let kind = parsePortalChatKind(params.kind);

  const stripped = stripClientFeedbackPrefix(content);
  if (stripped.offerTitle) {
    offerTitle = offerTitle || stripped.offerTitle;
    content = stripped.content;
  }

  if (params.fromAgent && looksLikeInternalHandoff(content) && audience !== 'agent') {
    if (params.viewer === 'client') {
      content = rewriteInternalHandoffForClient(content);
      kind = kind || 'client_step';
    } else {
      content = stripAgentLead(content);
      kind = kind || 'agent_note';
    }
  }

  if (!kind) {
    if (params.fromAgent && /Co teraz zrób:/i.test(content)) kind = 'client_step';
    else if (params.fromAgent && /Wybierz jedną odpowiedź poniżej/i.test(content)) kind = 'checkback';
    else kind = 'chat';
  }

  return { visible: true, content, kind, audience, offerTitle };
}
