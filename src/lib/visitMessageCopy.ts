/** Gotowe SMS / mail po wizycie — agent otwiera natywny sheet. */

import { buildClientVoice } from './clientVoice';

export type DebriefOutcome = 'interested' | 'maybe' | 'reject';

function visitVoice(params: { firstName: string; agentName: string; salutation?: string | null }) {
  return buildClientVoice({
    firstName: params.firstName,
    salutation: params.salutation,
    agentName: params.agentName,
  });
}

export function buildPostVisitSms(params: {
  firstName: string;
  outcome: DebriefOutcome;
  offerTitle: string;
  priceHint?: string;
  remindDays?: number;
  portalUrl: string;
  agentName: string;
  salutation?: string | null;
}): string {
  const v = visitVoice(params);
  const { a, c } = v;
  const hello = v.vocative ? `${v.vocative}, d` : 'D';
  const sign = v.agentFirstName || params.agentName;
  if (params.outcome === 'interested') {
    return `${hello}ziękuję za dzisiejsze oglądanie! Cieszę się, że mieszkanie ${c('Pani się spodobało', 'Panu się spodobało', 'się spodobało')}${params.priceHint ? ` — ${a('zanotowałem', 'zanotowałam')} kwotę ok. ${params.priceHint}` : ''}. Przygotuję kolejny krok i odezwę się wkrótce. ${sign}`;
  }
  if (params.outcome === 'maybe') {
    return `${hello}ziękuję za oglądanie. Rozumiem, że to decyzja na spokojnie — odezwę się za ${params.remindDays || 5} dni, bez pośpiechu. Wszystko jest w panelu: ${params.portalUrl} ${sign}`;
  }
  return `${hello}ziękuję za oglądanie i szczerość. Skoro to nie było „to”, poszukam czegoś lepiej dopasowanego — nowe propozycje pojawią się w panelu: ${params.portalUrl} ${sign}`;
}

export function buildPostVisitEmail(params: {
  firstName: string;
  outcome: DebriefOutcome;
  offerTitle: string;
  priceHint?: string;
  remindDays?: number;
  portalUrl: string;
  agentName: string;
  agencyName: string;
  salutation?: string | null;
}): { subject: string; body: string } {
  const v = visitVoice(params);
  const { a, c } = v;
  const signoff = `Pozdrawiam serdecznie,\n${params.agentName}\n${params.agencyName}`;
  if (params.outcome === 'interested') {
    return {
      subject: 'Dziękuję za oglądanie — co dalej',
      body: `${v.greeting}\n\ndziękuję za dzisiejsze oglądanie: ${params.offerTitle}. Bardzo się cieszę, że ${c('przypadło Pani do gustu', 'przypadło Panu do gustu', 'się spodobało')}.\n\n${params.priceHint ? `${a('Zanotowałem', 'Zanotowałam')} orientacyjną kwotę: ${params.priceHint}. ` : ''}Przygotuję kolejny krok i wkrótce się odezwę. Gdyby w międzyczasie pojawiły się pytania — proszę dzwonić śmiało.\n\nPanel: ${params.portalUrl}\n\n${signoff}`,
    };
  }
  if (params.outcome === 'maybe') {
    return {
      subject: `Dziękuję za oglądanie — odezwę się za ${params.remindDays || 5} dni`,
      body: `${v.greeting}\n\ndziękuję za dzisiejsze oglądanie. Rozumiem, że taka decyzja wymaga chwili.\n\nOdezwę się za ${params.remindDays || 5} dni, bez żadnego pośpiechu. Jeśli wcześniej pojawią się pytania albo wątpliwości, chętnie pomogę je rozwiać.\n\nPanel: ${params.portalUrl}\n\n${signoff}`,
    };
  }
  return {
    subject: 'Dziękuję za oglądanie — szukam dalej',
    body: `${v.greeting}\n\ndziękuję za dzisiejsze oglądanie i szczerą opinię. Skoro ta nieruchomość nie była „tą”, poszukam czegoś lepiej dopasowanego.\n\nNowe propozycje pojawią się w panelu — przy każdej wystarczy kliknąć „Chcę obejrzeć”, „Do przemyślenia” albo „Nie pasuje”.\n\nPanel: ${params.portalUrl}\n\n${signoff}`,
  };
}

export function smsUrl(phone: string, body: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `sms:${cleaned}${cleaned ? '' : ''}?body=${encodeURIComponent(body)}`;
}

export function mailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
