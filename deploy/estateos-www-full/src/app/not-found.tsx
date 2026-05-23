import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center bg-black px-6 pb-28 pt-12 text-center text-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">404</p>
      <h1 className="mt-4 max-w-lg text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Nie znaleziono strony
      </h1>
      <p className="mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-zinc-400">
        Ten adres nie istnieje albo został przeniesiony.
      </p>
      <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/"
          className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full bg-white px-8 text-[15px] font-semibold text-black transition-[transform,background-color] active:scale-[0.98] hover:bg-zinc-200"
        >
          Strona główna
        </Link>
        <Link
          href="/oferty"
          className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 text-[15px] font-semibold text-white backdrop-blur-sm transition-[transform,background-color] active:scale-[0.98] hover:bg-white/10"
        >
          Oferty
        </Link>
      </div>
    </main>
  );
}
