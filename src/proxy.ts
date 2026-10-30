import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'estateos.pl';

/** Prawdziwe ID Server Action to hash hex; skanery wysyłają śmieci typu "x", "0", "action". */
const SERVER_ACTION_ID = /^[0-9a-f]{40,64}$/i;

/**
 * Next.js 16: pojedynczy plik proxy zamiast middleware — tu HTTPS + ochrona tras.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const actionId = request.headers.get('next-action');
  if (actionId !== null && !SERVER_ACTION_ID.test(actionId)) {
    return new NextResponse(null, { status: 404 });
  }

  /**
   * HTTPS force: tylko gdy pośrednik jawnie zgłasza HTTP (np. klient na :80).
   * NIE używamy request.nextUrl.protocol === 'http:' przy proxy_pass na localhost —
   * wtedy Next zawsze widzi „http” do Node i robiłby 301 w pętli / blokując całą stronę i API.
   */
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

  // --- Sesja na chronionych trasach ---
  const session = request.cookies.get('estateos_session')?.value;
  const isProtectedRoute =
    pathname.startsWith('/centrala') || pathname.startsWith('/moje-konto/crm');

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
