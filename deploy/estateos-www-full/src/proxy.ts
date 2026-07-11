import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'estateos.pl';

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith('/centrala')) return true;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/moje-konto')) return true;
  if (pathname === '/dodaj-oferte' || pathname.startsWith('/dodaj-oferte/')) return true;
  if (pathname.startsWith('/edytuj-oferte')) return true;
  return false;
}

function loginRedirectUrl(request: NextRequest): URL {
  const login = new URL('/login', request.url);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next && next !== '/login') {
    login.searchParams.set('next', next);
  }
  return login;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV !== 'development') {
    const rawHost = request.headers.get('host')?.split(':')[0]?.toLowerCase();
    const isOurHost =
      rawHost === CANONICAL_HOST || rawHost === `www.${CANONICAL_HOST}`;
    if (rawHost && isOurHost) {
      const xfProto = (request.headers.get('x-forwarded-proto') || '')
        .split(',')[0]
        ?.trim();
      if (xfProto === 'http') {
        const url = request.nextUrl.clone();
        url.protocol = 'https:';
        url.hostname = CANONICAL_HOST;
        url.port = '';
        return NextResponse.redirect(url, 301);
      }
    }
  }

  const session = request.cookies.get('estateos_session')?.value;
  if (isProtectedPath(pathname) && !session) {
    return NextResponse.redirect(loginRedirectUrl(request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
