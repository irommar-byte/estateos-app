import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { prisma } from '@/lib/prisma';
import { savePortalAttachment } from '@/lib/crm/portalChat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ success: false, error: 'Panel niedostępny.' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ success: false, error: 'Błąd formularza.' }, { status: 400 });
  }

  const file = (formData.get('file') || formData.get('attachment') || formData.get('document')) as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, error: 'Brak pliku.' }, { status: 400 });
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
