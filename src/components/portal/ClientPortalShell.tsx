'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStoredPortalLocale } from '@/components/portal/PortalLocale';

/**
 * Panel klienta — jasny, „kamienny” motyw premium. Strona główna panelu ma własny czarny
 * nagłówek z logo; podstrony (dokument, raport) dostają cienki pasek z powrotem.
 */
export default function ClientPortalShell({ children, fontClassName = '' }: { children: React.ReactNode; fontClassName?: string }) {
  const pathname = usePathname() || '';
  const parts = pathname.split('/').filter(Boolean);
  const isMain = parts.length === 2 && parts[0] === 'klient';
  const backHref = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : '/';
  const { t } = useStoredPortalLocale(parts[0] === 'klient' ? parts[1] : null);

  return (
    <div className={`portal-lux ${fontClassName} min-h-[100dvh]`}>
      {!isMain ? (
        <header className="portal-lux-bar">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href={backHref} className="portal-lux-bar__back">
              ‹ {t('Wróć do panelu')}
            </Link>
            <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="h-5 w-auto" />
          </div>
        </header>
      ) : null}
      {children}
    </div>
  );
}
