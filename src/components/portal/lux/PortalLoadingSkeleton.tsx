"use client";

/** Szkielet panelu w kształcie prawdziwej strony — bez kręcącej się ikony. */
export default function PortalLoadingSkeleton() {
  return (
    <div className="portal-lux min-h-[100dvh]" aria-busy="true" aria-label="Ładowanie panelu">
      <div className="rounded-b-[32px] bg-black px-5 pb-6 pt-5 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <span className="eos-skel eos-skel--dark h-[22px] w-[120px] rounded-md" />
            <span className="eos-skel eos-skel--dark size-10 rounded-full" />
          </div>
          <span className="eos-skel eos-skel--dark mt-6 block h-3 w-40 rounded" />
          <span className="eos-skel eos-skel--dark mt-3 block h-8 w-[78%] rounded-lg" />
          <span className="eos-skel eos-skel--dark mt-2 block h-8 w-[52%] rounded-lg" />
          <div className="mt-6 grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="eos-skel eos-skel--dark h-[3px] rounded-full" />
            ))}
          </div>
          <span className="eos-skel eos-skel--dark mt-5 block h-[74px] rounded-[20px]" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6 sm:px-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-[24px] border border-[var(--lux-line)] bg-[var(--lux-card)] p-4">
            <span className="eos-skel size-10 rounded-[13px]" />
            <span className="flex-1 space-y-2">
              <span className="eos-skel block h-3.5 w-1/3 rounded" />
              <span className="eos-skel block h-3 w-2/3 rounded" />
            </span>
          </div>
        ))}
      </div>
      <p className="sr-only">Ładujemy Twój panel…</p>
    </div>
  );
}
