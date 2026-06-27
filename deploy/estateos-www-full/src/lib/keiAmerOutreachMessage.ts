export const KEI_OUTREACH_TEMPLATE_STORAGE_KEY = 'eos_kei_outreach_template_v4';
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

Piszę z EstateOS — polskiego portalu nieruchomości: {{siteUrl}}

Zwracamy się w sprawie Państwa ogłoszenia na {{source}} ({{location}}). Zachęcamy do bezpłatnej publikacji u nas — bez opłat za pierwsze dodanie oferty.

Wystarczy jeden krok: po rejestracji wklejają Państwo link do gotowego ogłoszenia, a system automatycznie przeniesie zdjęcia, opis i parametry nieruchomości. Nie trzeba tworzyć oferty od zera.

Na EstateOS działają inwestorzy z aktywnymi radarami — otrzymują powiadomienia o dopasowanych lokalach. Państwa ogłoszenie może od razu trafić do osób, które już czekają na takie nieruchomości.

Link do bezpłatnego dodania oferty (import z linku):
{{inviteUrl}}

W razie pytań prosimy o odpowiedź na tę wiadomość.

Z poważaniem,
Zespół EstateOS
{{siteUrl}}`;

const LEGACY_TEMPLATE_MARKERS = [
  'jak w narzędziu KEI AMER',
  'Zapraszamy do bezpłatnego dodania nieruchomości na EstateOS',
  'resztą zajmie się system.',
  'PRZENIEŚ NIERUCHOMOŚĆ NA ESTATEOS',
  'prowizja już wliczona w cenę dla kupującego',
  'EstateOS™ to platforma z ceną ostateczną',
  '{{inviteCta}}',
  '════════════════',
  'Prowadzimy EstateOS, mapę nieruchomości w Polsce',
  'W razie pytań — proszę śmiało odpisać',
];

const VOIVODESHIPS = new Set(
  [
    'dolnośląskie',
    'kujawsko-pomorskie',
    'lubelskie',
    'lubuskie',
    'łódzkie',
    'małopolskie',
    'mazowieckie',
    'opolskie',
    'podkarpackie',
    'podlaskie',
    'pomorskie',
    'śląskie',
    'świętokrzyskie',
    'warmińsko-mazurskie',
    'wielkopolskie',
    'zachodniopomorskie',
  ].map((v) => v.toLowerCase()),
);

export type KeiOutreachTemplateVars = {
  location: string;
  source: string;
  inviteUrl: string;
  siteUrl?: string;
};

export const DEFAULT_ESTATEOS_SITE_URL = 'https://estateos.pl';

function capitalizeSegment(segment: string): string {
  return segment
    .split(/([\s-]+)/)
    .map((part) => {
      if (!part || /^[\s-]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

/** Czytelna lokalizacja z adresu KEI (bez województwa, z polską kapitalizacją). */
export function formatOutreachLocation(raw: string): string {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Państwa lokalizacji';

  let slice = parts;
  if (VOIVODESHIPS.has(parts[0].toLowerCase())) {
    slice = parts.slice(1);
  }
  if (slice.length === 0) slice = parts;

  const formatted = slice.map(capitalizeSegment);
  if (formatted.length >= 3) {
    const [city, district, ...rest] = formatted;
    const street = rest.join(', ');
    return street ? `${street}, ${district}, ${city}` : `${district}, ${city}`;
  }
  if (formatted.length === 2) {
    return `${formatted[1]}, ${formatted[0]}`;
  }
  return formatted[0];
}

/** Opcjonalny krótki CTA — domyślny szablon używa samego {{inviteUrl}}. */
export function formatInviteCtaBlock(inviteUrl: string): string {
  const url = inviteUrl?.trim();
  if (!url) return '';
  return `Dodaj ofertę na EstateOS:\n${url}`;
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
  const location = formatOutreachLocation(vars.location || '');
  const source = vars.source?.trim() || 'portalu ogłoszeniowego';
  const inviteUrl = vars.inviteUrl?.trim() || '';
  const siteUrl = vars.siteUrl?.trim() || DEFAULT_ESTATEOS_SITE_URL;
  const inviteCta = formatInviteCtaBlock(inviteUrl);

  return (template || DEFAULT_KEI_OUTREACH_TEMPLATE)
    .replace(/\{\{location\}\}/g, location)
    .replace(/\{\{source\}\}/g, source)
    .replace(/\{\{inviteCta\}\}/g, inviteCta)
    .replace(/\{\{inviteUrl\}\}/g, inviteUrl)
    .replace(/\{\{siteUrl\}\}/g, siteUrl);
}

function isLegacyOutreachTemplate(saved: string): boolean {
  return LEGACY_TEMPLATE_MARKERS.some((marker) => saved.includes(marker));
}

export function loadKeiOutreachTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_KEI_OUTREACH_TEMPLATE;
  try {
    const saved = window.localStorage.getItem(KEI_OUTREACH_TEMPLATE_STORAGE_KEY);
    if (saved?.trim() && !isLegacyOutreachTemplate(saved)) return saved;

    for (const legacyKey of [
      'eos_kei_outreach_template_v3',
      'eos_kei_outreach_template_v2',
      'eos_kei_outreach_template_v1',
    ]) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy?.trim() && !isLegacyOutreachTemplate(legacy)) {
        window.localStorage.setItem(KEI_OUTREACH_TEMPLATE_STORAGE_KEY, legacy);
        return legacy;
      }
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
