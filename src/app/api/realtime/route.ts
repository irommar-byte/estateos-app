export const dynamic = 'force-dynamic';

type SseClient = { id: string; send: (data: unknown) => void };

type GlobalWithSse = typeof globalThis & {
  sseClients?: Set<SseClient>;
};

const globalWithSse = globalThis as GlobalWithSse;
if (!globalWithSse.sseClients) globalWithSse.sseClients = new Set<SseClient>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return new Response('Bad Request', { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        try {
            controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n'));
        } catch {}
      };
      
      const client: SseClient = { id: userId, send };
      globalWithSse.sseClients!.add(client);
      send({ type: 'PING' }); 
      
      const iv = setInterval(() => send({ type: 'PING' }), 10000);
      
      req.signal.addEventListener('abort', () => { 
          clearInterval(iv); 
          globalWithSse.sseClients!.delete(client); 
      });
    }
  });
  
  return new Response(stream, { 
      headers: { 
          'Content-Type': 'text/event-stream', 
          'Cache-Control': 'no-cache, no-transform', 
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no' 
      } 
  });
}

export function sendToUsers(userIds: Array<string | number>, payload: unknown) {
  const ids = userIds.map(String);
  globalWithSse.sseClients?.forEach((client) => {
      if (ids.includes(String(client.id))) {
        client.send(payload);
      }
  });
}
