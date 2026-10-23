/** Copy Live Chat: klient dostaje ludzką odpowiedź agenta, agent — instrukcję operacyjną. */

import { buildClientVoice, withChatLead, type ClientVoice } from '@/lib/crm/clientVoice';

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
    /przekazuję to agentowi/i.test(text) ||
    /Klient chce umówić/i.test(text)
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

/** Pytanie z szybkimi odpowiedziami — przyciski są pod wiadomością, więc nie dopisujemy instrukcji. */
export function wrapCheckbackQuestion(body: string): string {
  return String(body || '').trim();
}

export function handoffClientKindFromReason(reason: string): HandoffClientKind {
  if (/Chcę oglądać|termin prezentacji/i.test(reason)) return 'viewing';
  if (/sprawdzenie|konkretną odpowiedź/i.test(reason)) return 'detail';
  return 'contact';
}

function voiceOrNeutral(voice?: ClientVoice | null): ClientVoice {
  return voice || buildClientVoice({});
}

export function buildHandoffClientMessage(kind: HandoffClientKind, voice?: ClientVoice | null): string {
  const v = voiceOrNeutral(voice);
  const { c } = v;
  if (kind === 'viewing') {
    return [
      withChatLead(v, v.pick('handoff-viewing-1', ['świetnie, w takim razie umówmy oglądanie.', 'bardzo się cieszę — umówmy oglądanie.', 'doskonale, to umawiamy oglądanie.'])),
      `Odezwę się z propozycją terminu — ${c('zobaczy ją Pani', 'zobaczy ją Pan', 'pojawi się')} tutaj i w mailu, a potwierdzenie to jedno kliknięcie. Jeśli ${c('ma Pani', 'ma Pan', 'są')} dogodne dni lub godziny, proszę je tu napisać.`,
      'Do tego czasu wstrzymuję nowe propozycje, żebyśmy mogli skupić się na tej jednej.',
    ].join('\n\n');
  }
  if (kind === 'detail') {
    return [
      withChatLead(v, v.pick('handoff-detail-1', ['dziękuję za pytanie — sprawdzę to i odpiszę tutaj.', 'dobre pytanie. Sprawdzę szczegóły i wrócę z odpowiedzią w tej rozmowie.'])),
      'Jeśli jest coś jeszcze, co warto wiedzieć, proszę śmiało dopisać.',
    ].join('\n\n');
  }
  return [
    withChatLead(v, v.pick('handoff-contact-1', ['dziękuję, odezwę się, żeby ustalić oglądanie albo krótką rozmowę.', 'dziękuję — skontaktuję się, żeby umówić oglądanie lub rozmowę.'])),
    'Jeśli są godziny, które pasują najbardziej, proszę je tu napisać.',
  ].join('\n\n');
}

export function buildHandoffAgentNote(reason: string, agentFirstName?: string | null): string {
  const name = String(agentFirstName || '').trim();
  const lead = name ? `${name} — ` : '';
  const pause = 'Wstrzymuję automatyczne dokładanie kolejnej oferty, aż skontaktujesz się z klientem.';
  return `${lead}${String(reason || '').trim()} ${pause}`.trim();
}

export function rewriteInternalHandoffForClient(content: string, voice?: ClientVoice | null): string {
  return buildHandoffClientMessage(handoffClientKindFromReason(stripAgentLead(content)), voice);
}

export function checkbackAckForClient(params: { optionId: string; handedToAgent: boolean; voice?: ClientVoice | null }): string {
  const v = voiceOrNeutral(params.voice);
  const { a } = v;
  if (params.optionId === 'no') {
    return v.pick('ack-no', [
      `Dziękuję, że ${v.c('Pani poprawiła', 'Pan poprawił', 'to prostujemy')} — wolę dopytać, niż szukać w złą stronę. Proszę napisać jednym zdaniem, jak to jest naprawdę, a poprawię kryteria.`,
      `Rozumiem, w takim razie ${a('źle to odczytałem', 'źle to odczytałam')}. Proszę napisać krótko, o co dokładnie chodzi — dopasuję do tego dalsze poszukiwania.`,
    ]);
  }
  if (params.handedToAgent) {
    return v.pick('ack-handoff', [
      'Dziękuję, mam tę odpowiedź. Odpiszę tutaj najszybciej, jak to możliwe.',
      'Dziękuję — przyjrzę się temu osobiście i wrócę z odpowiedzią w tej rozmowie.',
    ]);
  }
  return v.pick('ack-yes', [
    'Dziękuję, zapisuję to i szukam dalej z uwzględnieniem tej odpowiedzi.',
    `Dziękuję, to dla mnie ważna informacja. Kolejne propozycje będą już ją uwzględniać.`,
    `Świetnie, ${a('zanotowałem', 'zanotowałam')}. Wracam do szukania.`,
  ]);
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
