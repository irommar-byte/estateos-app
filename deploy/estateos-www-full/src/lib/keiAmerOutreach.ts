import { getPasskeyOrigin } from '@/lib/env.server';
import {
  buildPortalOnboardingUrl,
  createPortalOnboardingInvite,
} from '@/lib/portalOnboardingInvite';
import {
  assertKeiListingAvailableForOutreach,
  markKeiListingOutreachSent,
  normalizeKeiPortalUrl,
} from '@/lib/keiAmerListingState';

export type KeiOutreachSelection = {
  keiId?: string;
  portalUrl: string;
  address?: string;
};

export type KeiOutreachMessageItem = {
  keiId: string;
  portalUrl: string;
  address: string;
  inviteUrl: string;
  message: string;
  sentAt: string;
};

function buildOwnerOutreachMessage(options: {
  address: string;
  inviteUrl: string;
  sourceLabel?: string;
}): string {
  const location = options.address?.trim() || 'Państwa nieruchomość';
  const source = options.sourceLabel?.trim() || 'portalu ogłoszeniowego';

  return [
    'Dzień dobry,',
    '',
    `Zauważyliśmy ogłoszenie (${location}) na ${source}.`,
    'Zapraszamy do bezpłatnego dodania nieruchomości na EstateOS — import z linku do ogłoszenia i publikacja na profilu w kilka minut:',
    '',
    options.inviteUrl,
    '',
    'Po rejestracji wystarczy wkleić link do ogłoszenia — resztą zajmie się system (jak w narzędziu KEI AMER).',
    '',
    'Pozdrawiamy,',
    'Zespół EstateOS',
  ].join('\n');
}

function sourceLabelFromPortalUrl(portalUrl: string): string {
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

export async function sendKeiOwnerOutreach(options: {
  adminUserId: number;
  selections: KeiOutreachSelection[];
}): Promise<{ ok: true; items: KeiOutreachMessageItem[]; message: string }> {
  const selections = (options.selections || [])
    .map((row) => ({
      keiId: String(row.keiId || '').trim(),
      portalUrl: normalizeKeiPortalUrl(row.portalUrl),
      address: String(row.address || '').trim(),
    }))
    .filter((row) => row.portalUrl);

  if (selections.length === 0) {
    throw new Error('Wybierz co najmniej jedno ogłoszenie.');
  }
  if (selections.length > 25) {
    throw new Error('Maksymalnie 25 ogłoszeń na raz.');
  }

  const origin = getPasskeyOrigin();
  const items: KeiOutreachMessageItem[] = [];

  for (const row of selections) {
    await assertKeiListingAvailableForOutreach(row.portalUrl);
    const { token } = createPortalOnboardingInvite(options.adminUserId);
    const inviteUrl = buildPortalOnboardingUrl(origin, token);
    const disposition = await markKeiListingOutreachSent({
      portalUrl: row.portalUrl,
      keiListingId: row.keiId || undefined,
      adminUserId: options.adminUserId,
    });

    items.push({
      keiId: row.keiId || row.portalUrl,
      portalUrl: row.portalUrl,
      address: row.address || row.portalUrl,
      inviteUrl,
      message: buildOwnerOutreachMessage({
        address: row.address,
        inviteUrl,
        sourceLabel: sourceLabelFromPortalUrl(row.portalUrl),
      }),
      sentAt: disposition.outreachSentAt || new Date().toISOString(),
    });
  }

  const message =
    items.length === 1
      ? 'Przygotowano wiadomość zaproszenia dla właściciela. Skopiuj treść i wyślij na OtoDom/OLX.'
      : `Przygotowano ${items.length} wiadomości zaproszenia. Skopiuj i wyślij każdą na portalu.`;

  return { ok: true, items, message };
}

export function previewKeiOwnerOutreachMessage(options: {
  address?: string;
  portalUrl: string;
  inviteUrl: string;
}): string {
  return buildOwnerOutreachMessage({
    address: options.address || '',
    inviteUrl: options.inviteUrl,
    sourceLabel: sourceLabelFromPortalUrl(options.portalUrl),
  });
}
