import { NextResponse } from 'next/server';
import { BUYER_AGENT_COOKIE, BUYER_AGENT_COOKIE_MAX_AGE_SEC, loadLinkableBuyerAgent } from '@/lib/buyerIntake.server';

export const dynamic = 'force-dynamic';

/**
 * Osobisty link agenta: `/szukam/a/{id}`. Zapamiętuje agenta i otwiera formularz —
 * po wysłaniu kupujący zostaje klientem właśnie tego agenta.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await ctx.params;
  const agent = await loadLinkableBuyerAgent(Number(agentId));
  // Względny adres — za proxy req.url wskazuje wewnętrzny host serwera.
  const res = new NextResponse(null, { status: 307, headers: { Location: '/szukam' } });
  if (agent) {
    res.cookies.set(BUYER_AGENT_COOKIE, String(agent.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: BUYER_AGENT_COOKIE_MAX_AGE_SEC,
    });
  } else {
    res.cookies.delete(BUYER_AGENT_COOKIE);
  }
  return res;
}
