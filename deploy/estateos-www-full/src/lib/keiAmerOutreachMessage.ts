export const KEI_OUTREACH_TEMPLATE_STORAGE_KEY = 'eos_kei_outreach_template_v2';
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

/** Wersja domyślna — ekskluzywny blok CTA (plain text, do wklejenia na OtoDom). */
export const DEFAULT_KEI_OUTREACH_TEMPLATE = `Dzień dobry,

Zauważyliśmy Państwa ogłoszenie ({{location}}) na {{source}}.

EstateOS™ to platforma z ceną ostateczną — prowizja już wliczona w cenę dla kupującego. Publikacja po moderacji, import z linku do ogłoszenia w kilka minut.

{{inviteCta}}

Po rejestracji wystarczy wkleić link do ogłoszenia — zdjęcia i opis zostają.

Z poważaniem,
Zespół EstateOS™`;

const LEGACY_TEMPLATE_MARKERS = [
  'jak w narzędziu KEI AMER',
  'Zapraszamy do bezpłatnego dodania nieruchomości na EstateOS',
  'resztą zajmie się system.',
];

export type KeiOutreachTemplateVars = {
  location: string;
  source: string;
  inviteUrl: string;
};

export function formatInviteCtaBlock(inviteUrl: string): string {
  const url = inviteUrl?.trim();
  if (!url) return '';
  return [
    '═══════════════════════════════════════',
    '  ▶ PRZENIEŚ NIERUCHOMOŚĆ NA ESTATEOS™',
    '     bezpłatny import · cena ostateczna',
    '───────────────────────────────────────',
    url,
    '═══════════════════════════════════════',
  ].join('\n');
}

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
  const inviteCta = formatInviteCtaBlock(inviteUrl);

  return (template || DEFAULT_KEI_OUTREACH_TEMPLATE)
    .replace(/\{\{location\}\}/g, location)
    .replace(/\{\{source\}\}/g, source)
    .replace(/\{\{inviteCta\}\}/g, inviteCta)
    .replace(/\{\{inviteUrl\}\}/g, inviteUrl);
}

function isLegacyOutreachTemplate(saved: string): boolean {
  return LEGACY_TEMPLATE_MARKERS.some((marker) => saved.includes(marker));
}

export function loadKeiOutreachTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_KEI_OUTREACH_TEMPLATE;
  try {
    const saved = window.localStorage.getItem(KEI_OUTREACH_TEMPLATE_STORAGE_KEY);
    if (saved?.trim() && !isLegacyOutreachTemplate(saved)) return saved;
    const legacyV1 = window.localStorage.getItem('eos_kei_outreach_template_v1');
    if (legacyV1?.trim() && !isLegacyOutreachTemplate(legacyV1)) {
      window.localStorage.setItem(KEI_OUTREACH_TEMPLATE_STORAGE_KEY, legacyV1);
      return legacyV1;
    }
    return DEFAULT_KEI_OUTREACH_TEMPLATE;
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
