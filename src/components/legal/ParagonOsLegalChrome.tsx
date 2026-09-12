import Link from 'next/link';
import { PARAGONOS_PATHS } from '@/lib/paragonOsLegal';

export default function ParagonOsLegalChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={PARAGONOS_PATHS.home} className="text-base font-semibold tracking-tight">
            ParagonOS™
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            <Link className="hover:text-zinc-900" href={PARAGONOS_PATHS.privacyPl}>
              Polityka
            </Link>
            <Link className="hover:text-zinc-900" href={PARAGONOS_PATHS.privacyEn}>
              Privacy
            </Link>
            <Link className="hover:text-zinc-900" href={PARAGONOS_PATHS.termsPl}>
              Regulamin
            </Link>
            <Link className="hover:text-zinc-900" href={PARAGONOS_PATHS.termsEn}>
              Terms
            </Link>
            <Link className="hover:text-zinc-900" href={PARAGONOS_PATHS.supportPl}>
              Wsparcie
            </Link>
            <Link className="hover:text-zinc-900" href={PARAGONOS_PATHS.supportEn}>
              Support
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-zinc-500">
          <p>ParagonOS™ — aplikacja iOS. Kontakt: kontakt@estateos.pl (tytuł: ParagonOS).</p>
          <p className="mt-2">
            Te strony nie są regulaminem ani polityką prywatności portalu nieruchomości EstateOS™.
          </p>
        </div>
      </footer>
    </div>
  );
}
