import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { prisma } from '@/lib/prisma';
import { PORTAL_MAX_FILE_BYTES, savePortalAttachment } from '@/lib/crm/portalChat';
import { resolvePortalAccess, parsePortalPermissions } from '@/lib/crm/portalAccess';
import {
  attachClientDocument,
  documentsSummary,
  loadClientDocuments,
  setClientDocumentNotApplicable,
} from '@/lib/crm/clientDocuments';
import { logPortalEvent } from '@/lib/crm/portalEvents';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Wolniejsze łącza: 20 MB przy ~1 Mb/s to ok. 3 minuty. */
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ token: string }> };

async function ownerClient(rawToken: string) {
  const access = await resolvePortalAccess(rawToken);
  if (!access) return { client: null, reason: 'expired' as const };
  if (access.viewer.role !== 'owner') return { client: null, reason: 'partner' as const };
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: access.portalToken, status: 'ACTIVE' },
    select: { id: true, type: true, agencyUserId: true, firstName: true, lastName: true, portalPermissions: true },
  });
  return client ? { client, reason: null } : { client: null, reason: 'expired' as const };
}

function denied(reason: 'expired' | 'partner') {
  return reason === 'partner'
    ? NextResponse.json(
        { error: 'Dokumenty może wysyłać tylko osoba, dla której agent założył panel. Z dostępu dla drugiej osoby można je tylko oglądać.' },
        { status: 403 },
      )
    : NextResponse.json({ error: 'Ten link do panelu wygasł albo został zmieniony. Poproś agenta o nowy link.' }, { status: 404 });
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const owner = await ownerClient(token);
  if (!owner.client) return denied(owner.reason ?? 'expired');
  const documents = await loadClientDocuments(owner.client.id);
  return NextResponse.json({ success: true, documents, summary: documentsSummary(documents), maxBytes: PORTAL_MAX_FILE_BYTES });
}

/** Klient wrzuca plik do pozycji z listy dokumentów (multipart: file + itemKey). */
export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const owner = await ownerClient(token);
  if (!owner.client) return denied(owner.reason ?? 'expired');
  const client = owner.client;
  if (!parsePortalPermissions(client.portalPermissions).documents) {
    return NextResponse.json(
      { error: 'Agent wyłączył wysyłanie dokumentów przez panel — przekaż je bezpośrednio agentowi (mailem albo osobiście).' },
      { status: 403 },
    );
  }

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > PORTAL_MAX_FILE_BYTES + 512 * 1024) {
    return NextResponse.json(
      {
        error: `Plik ma ok. ${(declared / (1024 * 1024)).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB, a limit to ${PORTAL_MAX_FILE_BYTES / (1024 * 1024)} MB. Zmniejsz go i wyślij ponownie.`,
      },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json(
      { error: 'Przesyłanie zostało przerwane w trakcie (np. słaby internet albo zamknięta karta). Spróbuj ponownie przy lepszym połączeniu.' },
      { status: 400 },
    );
  }
  const itemKey = String(formData.get('itemKey') || '').trim();
  const file = (formData.get('file') || formData.get('document')) as File | null;
  if (!itemKey) return NextResponse.json({ error: 'Nie wiadomo, do którego dokumentu dodać plik. Odśwież stronę i wybierz pozycję z listy.' }, { status: 400 });
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Plik nie dotarł na serwer. Wybierz go ponownie.' }, { status: 400 });
  }

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
    const documents = await loadClientDocuments(client.id);
    return NextResponse.json({ success: true, document: item, summary: documentsSummary(documents) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nie udało się zapisać pliku przy dokumencie.' }, { status: 409 });
  }
}

/** Klient zaznacza „Nie dotyczy mnie” przy pozycji opcjonalnej (albo cofa). JSON: { itemKey, notApplicable }. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const owner = await ownerClient(token);
  if (!owner.client) return denied(owner.reason ?? 'expired');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const item = await setClientDocumentNotApplicable({
      clientId: owner.client.id,
      itemKey: String(body.itemKey || ''),
      notApplicable: body.notApplicable !== false,
    });
    const documents = await loadClientDocuments(owner.client.id);
    return NextResponse.json({ success: true, document: item, summary: documentsSummary(documents) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nie udało się zapisać.' }, { status: 400 });
  }
}
