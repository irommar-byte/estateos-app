import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { processDiscoveryEmbeddingBatch } from '@/lib/discovery/embeddingWorker';

export async function POST(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const limit = Number(body?.limit || 20);
  try {
    const result = await processDiscoveryEmbeddingBatch(limit);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[DISCOVERY EMBEDDING PROCESS]', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Nie udało się przetworzyć batcha.' }, { status: 500 });
  }
}
