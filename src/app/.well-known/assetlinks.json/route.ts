import { buildAssetLinks } from '@/lib/wellKnownAppLinks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const body = buildAssetLinks();
  const json = JSON.stringify(body);
  return new Response(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
