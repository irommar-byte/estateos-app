import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { prisma } from '@/lib/prisma';
import { savePortalAttachment } from '@/lib/crm/portalChat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ success: false, error: 'Ten link do panelu wygasł albo został zmieniony. Poproś agenta o nowy link.' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Przesyłanie zostało przerwane w trakcie (np. słaby internet albo zamknięta karta). Spróbuj ponownie.' },
      { status: 400 },
    );
  }

  const file = (formData.get('file') || formData.get('attachment') || formData.get('document')) as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, error: 'Plik nie dotarł na serwer. Wybierz go ponownie.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await savePortalAttachment({
    clientId: client.id,
    buffer,
    mimeType: String(file.type || ''),
    originalFilename: String((file as File & { name?: string }).name || 'zalacznik'),
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, attachment: result.attachment });
}
