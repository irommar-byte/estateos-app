import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const session = request.cookies.get('estateos_session')?.value;
  const { pathname } = request.nextUrl;

  // Blokada ścieżek chronionych dla osób bez ciasteczka sesji
  const isProtectedRoute = pathname.startsWith('/centrala') || pathname.startsWith('/moje-konto/crm');

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/centrala/:path*', '/moje-konto/crm/:path*'],
};
