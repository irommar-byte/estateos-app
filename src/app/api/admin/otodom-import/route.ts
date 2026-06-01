import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { importOfferFromOtodomUrl, isOtodomOfferUrl } from '@/lib/otodomImport';
import { buildOtodomPresentationCopy } from '@/lib/otodomImportRewrite';

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

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? '').trim();
    if (!url) {
      return NextResponse.json({ error: 'Podaj link do oferty OtoDom.' }, { status: 400 });
    }
    if (!isOtodomOfferUrl(url)) {
      return NextResponse.json({ error: 'Obsługiwane są wyłącznie linki otodom.pl/oferta/...' }, { status: 400 });
    }

    const draft = await importOfferFromOtodomUrl(url);
    const presentation = await buildOtodomPresentationCopy(draft);
    return NextResponse.json({ ok: true, draft, presentation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import z OtoDom nie powiódł się.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
