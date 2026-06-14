import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  ensureKeiAmerSession,
  keiAmerFetch,
  rewriteKeiProxyHtml,
  rewriteKeiProxyLocation,
} from '@/lib/keiAmerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROXY_PREFIX = '/api/admin/kei-amer/proxy';

async function guardAdmin() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') return null;
  return admin;
}

function buildTargetPath(segments: string[] | undefined, search: string): string {
  const joined = (segments ?? []).map((part) => encodeURIComponent(part)).join('/');
  return joined ? `${joined}${search}` : `index.php${search}`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const { path } = await ctx.params;
  const session = await ensureKeiAmerSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.message }, { status: 502 });
  }

  const target = buildTargetPath(path, req.nextUrl.search);
  const upstream = await keiAmerFetch(target, { method: 'GET' });

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get('location');
    if (location) {
      const rewritten = rewriteKeiProxyLocation(location, PROXY_PREFIX);
      return NextResponse.redirect(new URL(rewritten, req.url), upstream.status);
    }
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const bodyBuffer = Buffer.from(await upstream.arrayBuffer());

  if (contentType.includes('text/html')) {
    const html = rewriteKeiProxyHtml(bodyBuffer.toString('utf8'), PROXY_PREFIX);
    return new NextResponse(html, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new NextResponse(bodyBuffer, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const { path } = await ctx.params;
  const session = await ensureKeiAmerSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.message }, { status: 502 });
  }

  const target = buildTargetPath(path, req.nextUrl.search);
  const contentType = req.headers.get('content-type') || 'application/x-www-form-urlencoded';
  const body = await req.arrayBuffer();

  const upstream = await keiAmerFetch(target, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });

  const upstreamType = upstream.headers.get('content-type') || 'application/octet-stream';
  const responseBody = Buffer.from(await upstream.arrayBuffer());

  if (upstreamType.includes('text/html')) {
    const html = rewriteKeiProxyHtml(responseBody.toString('utf8'), PROXY_PREFIX);
    return new NextResponse(html, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      'Content-Type': upstreamType,
      'Cache-Control': 'no-store',
    },
  });
}
