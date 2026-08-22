import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { createProspectCase } from '@/lib/desk/prospects';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';

export const maxDuration = 120;

export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  try {
    await ensureDeskSchema();
    const body = await req.json().catch(() => ({}));
    const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : null;

    let draft: Record<string, unknown> | null = null;
    let address = body.address ? String(body.address).trim() : null;
    let city = body.city ? String(body.city).trim() : null;
    let district = body.district ? String(body.district).trim() : null;
    let propertyType = body.propertyType ? String(body.propertyType).trim() : null;
    let price =
      body.price != null && Number.isFinite(Number(body.price)) ? Number(body.price) : null;

    if (sourceUrl && isSupportedImportOfferUrl(sourceUrl)) {
      try {
        const rawDraft = await importOfferFromUrl(sourceUrl);
        const enriched = await enrichOtodomImportDraft(rawDraft);
        draft = enriched as unknown as Record<string, unknown>;
        address =
          address ||
          [enriched.street, enriched.city].filter(Boolean).join(', ') ||
          address;
        city = city || (enriched.city ? String(enriched.city) : null);
        district = district || (enriched.district ? String(enriched.district) : null);
        propertyType = propertyType || (enriched.propertyType ? String(enriched.propertyType) : null);
        if (price == null && enriched.price != null) price = Number(enriched.price);
      } catch {
        // Keep manual fields; URL still stored on the case.
      }
    }

    const result = await createProspectCase({
      agencyUserId,
      name: body.name ? String(body.name) : undefined,
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
      phone: body.phone ?? null,
      email: body.email ?? null,
      source: body.source ? String(body.source) : sourceUrl ? 'portal_url' : 'manual',
      sourceUrl,
      address,
      city,
      district,
      propertyType,
      price,
      note: body.note ? String(body.note) : null,
      draft,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć prospectu.';
    if (message === 'INVALID_PHONE') {
      return NextResponse.json(
        { error: 'Telefon musi być w formacie międzynarodowym, np. +48501234567.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
