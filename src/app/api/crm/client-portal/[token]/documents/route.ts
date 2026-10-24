import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { prisma } from '@/lib/prisma';
import { savePortalAttachment } from '@/lib/crm/portalChat';
import { resolvePortalAccess, parsePortalPermissions } from '@/lib/crm/portalAccess';
import { attachClientDocument, documentsSummary, loadClientDocuments } from '@/lib/crm/clientDocuments';
import { logPortalEvent } from '@/lib/crm/portalEvents';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteCtx = { params: Promise<{ token: string }> };

async function ownerClient(rawToken: string) {
  const access = await resolvePortalAccess(rawToken);
  if (!access || access.viewer.role !== 'owner') return null;
  return prisma.agencyClient.findFirst({
    where: { portalToken: access.portalToken, status: 'ACTIVE' },
    select: { id: true, type: true, agencyUserId: true, firstName: true, lastName: true, portalPermissions: true },
  });
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await ownerClient(token);
  if (!client) return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
  const documents = await loadClientDocuments(client.id, client.type);
  return NextResponse.json({ success: true, documents, summary: documentsSummary(documents) });
}

/** Klient wrzuca plik do pozycji z listy dokumentów (multipart: file + itemKey). */
export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await ownerClient(token);
  if (!client) return NextResponse.json({ error: 'Dokumenty dodaje właściciel panelu.' }, { status: 403 });
  if (!parsePortalPermissions(client.portalPermissions).documents) {
    return NextResponse.json({ error: 'Dokumenty przekaż bezpośrednio agentowi.' }, { status: 403 });
  }
  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ error: 'Błąd formularza.' }, { status: 400 });
  }
  const itemKey = String(formData.get('itemKey') || '').trim();
  const file = (formData.get('file') || formData.get('document')) as File | null;
  if (!itemKey) return NextResponse.json({ error: 'Wybierz dokument z listy.' }, { status: 400 });
  if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Brak pliku.' }, { status: 400 });

  const saved = await savePortalAttachment({
    clientId: client.id,
    buffer: Buffer.from(await file.arrayBuffer()),
    mimeType: String(file.type || ''),
    originalFilename: String((file as File & { name?: string }).name || 'dokument'),
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  try {
    const item = await attachClientDocument({
      clientId: client.id,
      itemKey,
      fileUrl: saved.attachment.url,
      fileName: saved.attachment.name,
      mimeType: saved.attachment.mimeType,
    });
    await logPortalEvent({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      event: 'document_uploaded',
      title: 'Klient dodał dokument — sprawdź',
      body: `${`${client.firstName} ${client.lastName}`.trim()}: ${item.label}`,
      meta: { itemKey },
    });
    return NextResponse.json({ success: true, document: item });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nie udało się zapisać.' }, { status: 400 });
  }
}
