export const KEI_OUTREACH_TEMPLATE_STORAGE_KEY = 'eos_kei_outreach_template_v1';
export const KEI_OUTREACH_SENDER_STORAGE_KEY = 'eos_kei_outreach_sender_v1';

export type KeiOutreachSenderProfile = {
  name: string;
  email: string;
  phone: string;
};

export const DEFAULT_KEI_OUTREACH_SENDER: KeiOutreachSenderProfile = {
  name: '',
  email: '',
  phone: '',
};

export const DEFAULT_KEI_OUTREACH_TEMPLATE = `Dzień dobry,

Zauważyliśmy ogłoszenie ({{location}}) na {{source}}.
Zapraszamy do bezpłatnego dodania nieruchomości na EstateOS — import z linku do ogłoszenia i publikacja na profilu w kilka minut:

{{inviteUrl}}

Po rejestracji wystarczy wkleić link do ogłoszenia — resztą zajmie się system.

Pozdrawiamy,
Zespół EstateOS`;

export type KeiOutreachTemplateVars = {
  location: string;
  source: string;
  inviteUrl: string;
};

export function sourceLabelFromPortalUrl(portalUrl: string): string {
  try {
    const host = new URL(portalUrl).hostname.replace(/^www\./i, '').toLowerCase();
    if (host.includes('otodom')) return 'OtoDom';
    if (host.includes('olx')) return 'OLX';
    if (host.includes('nieruchomosci-online')) return 'Nieruchomosci-Online';
    return host;
  } catch {
    return 'portalu ogłoszeniowego';
  }
}

export function renderKeiOutreachMessage(
  template: string,
  vars: KeiOutreachTemplateVars,
): string {
  const location = vars.location?.trim() || 'Państwa nieruchomość';
  const source = vars.source?.trim() || 'portalu ogłoszeniowego';
  const inviteUrl = vars.inviteUrl?.trim() || '';

  return (template || DEFAULT_KEI_OUTREACH_TEMPLATE)
    .replace(/\{\{location\}\}/g, location)
    .replace(/\{\{source\}\}/g, source)
    .replace(/\{\{inviteUrl\}\}/g, inviteUrl);
}

export function loadKeiOutreachTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_KEI_OUTREACH_TEMPLATE;
  try {
    const saved = window.localStorage.getItem(KEI_OUTREACH_TEMPLATE_STORAGE_KEY);
    return saved?.trim() ? saved : DEFAULT_KEI_OUTREACH_TEMPLATE;
  } catch {
    return DEFAULT_KEI_OUTREACH_TEMPLATE;
  }
}

export function saveKeiOutreachTemplate(template: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEI_OUTREACH_TEMPLATE_STORAGE_KEY, template);
  } catch {
    /* ignore */
  }
}

export function loadKeiOutreachSender(): KeiOutreachSenderProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_KEI_OUTREACH_SENDER };
  try {
    const raw = window.localStorage.getItem(KEI_OUTREACH_SENDER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEI_OUTREACH_SENDER };
    const parsed = JSON.parse(raw) as Partial<KeiOutreachSenderProfile>;
    return {
      name: String(parsed.name || ''),
      email: String(parsed.email || ''),
      phone: String(parsed.phone || ''),
    };
  } catch {
    return { ...DEFAULT_KEI_OUTREACH_SENDER };
  }
}

export function saveKeiOutreachSender(sender: KeiOutreachSenderProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEI_OUTREACH_SENDER_STORAGE_KEY, JSON.stringify(sender));
  } catch {
    /* ignore */
  }
}
