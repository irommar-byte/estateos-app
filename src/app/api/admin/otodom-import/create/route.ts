import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { importOfferFromOtodomUrl, isOtodomOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft } from '@/lib/otodomImportCreate';

async function requireAdmin() {
  const nextAuth = await getServerSession(authOptions);
  const nextAuthEmail = String(nextAuth?.user?.email || '').trim().toLowerCase();
  if (nextAuthEmail) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthEmail },
      select: { id: true, role: true },
    });
    if (user?.role === 'ADMIN') return user;
  }

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

function isOtodomDraft(value: unknown): value is OtodomImportDraft {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.source === 'OTODOM' && typeof row.externalId === 'number';
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let draft: OtodomImportDraft | null = isOtodomDraft(body?.draft) ? body.draft : null;

    const url = String(body?.url ?? '').trim();
    if (!draft && url) {
      if (!isOtodomOfferUrl(url)) {
        return NextResponse.json({ error: 'Obsługiwane są wyłącznie linki otodom.pl/oferta/...' }, { status: 400 });
      }
      draft = await importOfferFromOtodomUrl(url);
    }

    if (!draft) {
      return NextResponse.json(
        { error: 'Najpierw przeanalizuj ofertę lub prześlij poprawny draft.' },
        { status: 400 },
      );
    }

    const result = await createOfferFromOtodomDraft(draft, admin.id);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          error: result.message,
          existingOfferId: result.existingOfferId,
          editUrl: `/edytuj-oferte/${result.existingOfferId}`,
          publicUrl: `/oferta/${result.existingOfferId}`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      offerId: result.offerId,
      offer: result.offer,
      images: result.images,
      editUrl: result.editUrl,
      publicUrl: result.publicUrl,
      message:
        result.images.uploaded > 0
          ? `Utworzono ofertę #${result.offerId} (PENDING) z ${result.images.uploaded} zdjęciami.`
          : `Utworzono ofertę #${result.offerId} (PENDING). Zdjęcia nie zostały pobrane — uzupełnij ręcznie.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć oferty z importu OtoDom.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
