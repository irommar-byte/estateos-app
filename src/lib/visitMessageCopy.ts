/** Gotowe SMS / mail po wizycie — agent otwiera natywny sheet. */

export type DebriefOutcome = 'interested' | 'maybe' | 'reject';

export function buildPostVisitSms(params: {
  firstName: string;
  outcome: DebriefOutcome;
  offerTitle: string;
  priceHint?: string;
  remindDays?: number;
  portalUrl: string;
  agentName: string;
}): string {
  const { firstName, outcome, offerTitle, portalUrl, agentName } = params;
  if (outcome === 'interested') {
    return `Dziękuję za dzisiejsze oglądanie, ${firstName}. Notuję zainteresowanie ofertą${params.priceHint ? ` ok. ${params.priceHint}` : ''}. Wkrótce dam znać co dalej. — ${agentName}`;
  }
  if (outcome === 'maybe') {
    return `Dziękuję za oglądanie, ${firstName}. Dam znać za ${params.remindDays || 5} dni — bez zobowiązań. Wszystko w panelu: ${portalUrl} — ${agentName}`;
  }
  return `Dziękuję za oglądanie, ${firstName}. Na podstawie rozmowy wyślę podobne oferty do panelu: ${portalUrl} — ${agentName}`;
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
}): { subject: string; body: string } {
  if (params.outcome === 'interested') {
    return {
      subject: 'Dziękuję za oglądanie — kolejny krok',
      body: `Dzień dobry ${params.firstName},\n\ndziękuję za dzisiejsze oglądanie oferty ${params.offerTitle}.\n\nNotuję Państwa zainteresowanie${params.priceHint ? ` oraz orientacyjną kwotę: ${params.priceHint}` : ''}.\nPrzygotowuję kolejny krok i odezwię się wkrótce.\n\nPanel: ${params.portalUrl}\n\nPozdrawiam,\n${params.agentName}\n${params.agencyName}`,
    };
  }
  if (params.outcome === 'maybe') {
    return {
      subject: `Dziękuję za oglądanie — odezwę się za ${params.remindDays || 5} dni`,
      body: `Dzień dobry ${params.firstName},\n\ndziękuję za dzisiejsze oglądanie.\n\nRozumiem, że potrzebują Państwo chwili na decyzję.\nOdezwę się za ${params.remindDays || 5} dni — bez nacisku.\n\nPanel: ${params.portalUrl}\n\nPozdrawiam,\n${params.agentName}`,
    };
  }
  return {
    subject: 'Propozycje podobnych mieszkań dla Pana/Pani',
    body: `Dzień dobry ${params.firstName},\n\ndziękuję za dzisiejsze oglądanie. Skoro ta nieruchomość nie była „tą”, przygotuję kolejne propozycje.\n\nProszę zajrzeć do panelu i przy każdej ofercie wybrać:\n• Chcę oglądać\n• Do przemyślenia\n• Nie pasuje\n\nPanel: ${params.portalUrl}\n\nPozdrawiam,\n${params.agentName}`,
  };
}

export function smsUrl(phone: string, body: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `sms:${cleaned}${cleaned ? '' : ''}?body=${encodeURIComponent(body)}`;
}

export function mailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
