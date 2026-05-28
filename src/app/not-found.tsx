import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center bg-[var(--eos-bg)] px-6 pb-28 pt-12 text-center text-[var(--eos-text)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--eos-muted)]">404</p>
      <h1 className="mt-4 max-w-lg text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Nie znaleziono strony
      </h1>
      <p className="mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-[var(--eos-muted)]">
        Ten adres nie istnieje albo został przeniesiony.
      </p>
      <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/"
          className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full bg-[var(--eos-accent)] px-8 text-[15px] font-semibold text-[var(--eos-contrast)] transition-[transform,filter] active:scale-[0.98] hover:brightness-105"
        >
          Strona główna
        </Link>
        <Link
          href="/oferty"
          className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] px-8 text-[15px] font-semibold text-[var(--eos-text)] backdrop-blur-sm transition-[transform,background-color] active:scale-[0.98] hover:bg-[var(--eos-surface-strong)]"
        >
          Oferty
        </Link>
      </div>
    </main>
  );
}
