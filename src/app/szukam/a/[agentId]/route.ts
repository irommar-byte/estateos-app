import { NextResponse } from 'next/server';
import { BUYER_AGENT_COOKIE, BUYER_AGENT_COOKIE_MAX_AGE_SEC, loadLinkableBuyerAgent } from '@/lib/buyerIntake.server';

export const dynamic = 'force-dynamic';

/**
 * Osobisty link agenta: `/szukam/a/{id}`. Zapamiętuje agenta i otwiera formularz —
 * po wysłaniu kupujący zostaje klientem właśnie tego agenta.
 */
export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await ctx.params;
  const target = new URL('/szukam', req.url);
  const agent = await loadLinkableBuyerAgent(Number(agentId));
  const res = NextResponse.redirect(target, 307);
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
