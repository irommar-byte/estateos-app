import { getPasskeyOrigin } from '@/lib/env.server';
import {
  DEFAULT_KEI_OUTREACH_TEMPLATE,
  renderKeiOutreachMessage,
  sourceLabelFromPortalUrl,
} from '@/lib/keiAmerOutreachMessage';
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

export async function sendKeiOwnerOutreach(options: {
  adminUserId: number;
  selections: KeiOutreachSelection[];
  messageTemplate?: string;
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
  const template = options.messageTemplate?.trim() || DEFAULT_KEI_OUTREACH_TEMPLATE;
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
      message: renderKeiOutreachMessage(template, {
        location: row.address,
        inviteUrl,
        source: sourceLabelFromPortalUrl(row.portalUrl),
      }),
      sentAt: disposition.outreachSentAt || new Date().toISOString(),
    });
  }

  const message =
    items.length === 1
      ? 'Zaproszenie gotowe — wiadomość w schowku, ogłoszenie otwarte w nowej karcie.'
      : `Przygotowano ${items.length} zaproszeń — realizuj kolejno w kreatorze.`;

  return { ok: true, items, message };
}
