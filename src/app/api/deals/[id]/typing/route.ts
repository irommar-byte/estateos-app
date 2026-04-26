const globalAny = global as any;
if (!globalAny.typingStore) globalAny.typingStore = {};

import { NextResponse } from 'next/server';
const sseGlobal = globalThis as typeof globalThis & { sseClients?: Set<{ send: (payload: unknown) => void }> };

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
     const resolvedParams = await context.params;
     const id = resolvedParams.id;
     const body = await req.json().catch(() => ({} as { userId?: number }));
     
     if (sseGlobal.sseClients) {
       sseGlobal.sseClients.forEach((c) => {
         if (!globalAny.typingStore[Number(id)]) globalAny.typingStore[Number(id)] = {};
         globalAny.typingStore[Number(id)][body.userId] = Date.now();
         c.send({ type: 'TYPING', payload: { dealId: Number(id), userId: body.userId } });
       });
     }
     return NextResponse.json({ success: true });
  } catch(e: unknown) { 
     const errorMessage = e instanceof Error ? e.message : 'Unknown error';
     return NextResponse.json({ success: false, error: errorMessage }); 
  }
}