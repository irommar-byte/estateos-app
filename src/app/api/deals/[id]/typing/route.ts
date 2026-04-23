const globalAny = global as any;
if (!globalAny.typingStore) globalAny.typingStore = {};

import { NextResponse } from 'next/server';
export async function POST(req, { params }) {
  try {
     const resolvedParams = await params;
     const id = resolvedParams.id;
     const body = await req.json().catch(()=>({}));
     
     if (global.sseClients) {
         global.sseClients.forEach(c => {
             if(!globalAny.typingStore[Number(id)]) globalAny.typingStore[Number(id)]={}; globalAny.typingStore[Number(id)][body.userId]=Date.now(); c.send({ type: 'TYPING', payload: { dealId: Number(id), userId: body.userId } });
         });
     }
     return NextResponse.json({ success: true });
  } catch(e) { 
     return NextResponse.json({ success: false, error: e.message }); 
  }
}