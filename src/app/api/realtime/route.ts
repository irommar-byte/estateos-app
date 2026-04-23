export const dynamic = 'force-dynamic';

if (!global.sseClients) global.sseClients = new Set();

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return new Response('Bad Request', { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data) => {
        try { 
            controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n')); 
        } catch(e) {}
      };
      
      const client = { id: userId, send };
      global.sseClients.add(client);
      send({ type: 'PING' }); 
      
      const iv = setInterval(() => send({ type: 'PING' }), 10000);
      
      req.signal.addEventListener('abort', () => { 
          clearInterval(iv); 
          global.sseClients.delete(client); 
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

export function sendToUsers(userIds, payload) {
  if (global.sseClients) {
    global.sseClients.forEach(client => {
      if (userIds.map(String).includes(String(client.id))) {
        client.send(payload);
      }
    });
  }
}
