import { resolveSmartLink, smartSearchUrl } from '@/lib/crm/smartSearch';
import { qrSvg } from '@/lib/qrSvg';

export const dynamic = 'force-dynamic';

/** Kod QR do linku wyszukiwarki — do pokazania kupującemu na telefonie albo wydruku. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const resolved = await resolveSmartLink(code);
  if (!resolved.agentUserId) return new Response('Not found', { status: 404 });
  return new Response(qrSvg(smartSearchUrl(code), { size: 512 }), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, max-age=3600' },
  });
}
