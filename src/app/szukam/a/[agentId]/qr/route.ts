import { loadLinkableBuyerAgent } from '@/lib/buyerIntake.server';
import { qrSvg } from '@/lib/qrSvg';

export const dynamic = 'force-dynamic';

/** Kod QR do osobistego linku agenta — do pokazania kupującemu na telefonie albo wydruku. */
export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await ctx.params;
  const agent = await loadLinkableBuyerAgent(Number(agentId));
  if (!agent) return new Response('Not found', { status: 404 });
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  return new Response(qrSvg(`${origin}/szukam/a/${agent.id}`, { size: 512 }), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
