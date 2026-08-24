import { NextResponse } from 'next/server';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const portalPath = `/klient/${encodeURIComponent(token)}`;
  return NextResponse.json(
    {
      id: portalPath,
      name: 'Panel Klienta EstateOS™',
      short_name: 'Panel EstateOS',
      description: 'Oferty, terminy i bezpośredni Live Chat z Twoim agentem.',
      start_url: portalPath,
      scope: '/klient/',
      display: 'standalone',
      background_color: '#f6f7f4',
      theme_color: '#10b981',
      icons: [
        {
          src: '/portal-icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/portal-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      shortcuts: [
        {
          name: 'Live Chat',
          short_name: 'Czat',
          url: `${portalPath}?chat=1`,
          icons: [{ src: '/portal-icon-192.png', sizes: '192x192', type: 'image/png' }],
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}
