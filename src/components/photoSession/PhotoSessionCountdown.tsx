'use client';

import { useEffect, useMemo, useState } from 'react';

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function computeParts(msLeft: number) {
  if (msLeft <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(msLeft / 86400000);
  const hours = Math.floor((msLeft % 86400000) / 3600000);
  const minutes = Math.floor((msLeft % 3600000) / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

type Props = {
  presentationIso: string;
  label?: string;
};

export default function PhotoSessionCountdown({
  presentationIso,
  label = 'DO SESJI ZDJĘCIOWEJ POZOSTAŁO',
}: Props) {
  const targetMs = useMemo(() => new Date(presentationIso).getTime(), [presentationIso]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const msLeft = useMemo(() => targetMs - Date.now(), [targetMs, tick]);
  const parts = computeParts(msLeft);

  if (!Number.isFinite(targetMs) || msLeft <= 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/80">{label}</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { v: String(parts.days), l: 'DNI' },
          { v: pad2(parts.hours), l: 'GODZ' },
          { v: pad2(parts.minutes), l: 'MIN' },
          { v: pad2(parts.seconds), l: 'SEK' },
        ].map((unit) => (
          <div key={unit.l} className="rounded-xl border border-emerald-500/20 bg-black/20 px-2 py-3">
            <p className="text-2xl font-black tabular-nums text-emerald-300">{unit.v}</p>
            <p className="mt-1 text-[9px] font-black tracking-widest text-emerald-300/70">{unit.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
