'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import {
  DEFAULT_PHONE_REGION_ISO,
  PHONE_REGIONS,
  buildE164FromRegion,
  formatLocalPhoneDisplay,
  getPhoneRegion,
  type PhoneRegion,
} from '@/lib/phoneRegions';

type PhoneCountryInputProps = {
  valueE164: string;
  onChangeE164: (e164: string) => void;
  disabled?: boolean;
  status?: 'idle' | 'checking' | 'available' | 'taken';
};

export default function PhoneCountryInput({
  valueE164,
  onChangeE164,
  disabled,
  status = 'idle',
}: PhoneCountryInputProps) {
  const [regionIso, setRegionIso] = useState(DEFAULT_PHONE_REGION_ISO);
  const [localDigits, setLocalDigits] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const region = useMemo(() => getPhoneRegion(regionIso), [regionIso]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const e164 = buildE164FromRegion(region, localDigits);
    if (e164 !== valueE164) onChangeE164(e164);
  }, [region, localDigits, onChangeE164, valueE164]);

  const borderClass =
    status === 'taken'
      ? 'border-red-500/50'
      : status === 'available'
        ? 'border-emerald-500/50'
        : 'border-white/10 focus-within:border-emerald-500';

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
        <Phone size={14} /> Numer telefonu
      </label>
      <div
        className={`flex items-stretch overflow-hidden rounded-2xl border bg-black/30 transition-colors ${borderClass}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-2 border-r border-white/10 px-3 py-4 text-left hover:bg-white/5 disabled:opacity-50"
        >
          <span className="text-xl leading-none">{region.flag}</span>
          <span className="text-sm font-black text-white">+{region.dialCode}</span>
          <ChevronDown size={14} className="text-white/40" />
        </button>
        <input
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          placeholder={region.iso2 === 'PL' ? '501 234 567' : 'numer krajowy'}
          className="min-w-0 flex-1 bg-transparent px-4 py-4 text-xl font-bold text-white outline-none placeholder:text-white/20"
          value={formatLocalPhoneDisplay(region.iso2, localDigits)}
          onChange={(e) => {
            const max = region.localMaxDigits;
            const digits = e.target.value.replace(/\D/g, '').slice(0, max);
            setLocalDigits(digits);
          }}
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
          {PHONE_REGIONS.map((r: PhoneRegion) => (
            <button
              key={r.iso2}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
              onClick={() => {
                setRegionIso(r.iso2);
                setLocalDigits('');
                setOpen(false);
              }}
            >
              <span className="text-lg">{r.flag}</span>
              <span className="flex-1 text-sm text-white">{r.namePl}</span>
              <span className="text-xs font-bold text-white/50">+{r.dialCode}</span>
            </button>
          ))}
        </div>
      )}

      {status === 'checking' && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Sprawdzam numer…</p>
      )}
      {status === 'available' && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500">Numer dostępny</p>
      )}
      {status === 'taken' && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">Numer już w użyciu</p>
      )}
    </div>
  );
}
