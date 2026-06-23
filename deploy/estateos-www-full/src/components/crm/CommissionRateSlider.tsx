'use client';

import {
  COMMISSION_RATE_DEFAULT,
  COMMISSION_RATE_MAX,
  COMMISSION_RATE_MIN,
  COMMISSION_RATE_STEP,
  formatCommissionRate,
  snapCommissionRate,
} from '@/lib/leadTransferShared';

type Props = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

export default function CommissionRateSlider({ value, onChange, className = '' }: Props) {
  const safeValue = snapCommissionRate(Number.isFinite(value) ? value : COMMISSION_RATE_DEFAULT);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
          Prowizja agencji
        </span>
        <span className="text-lg font-black text-emerald-500">{formatCommissionRate(safeValue)}</span>
      </div>
      <input
        type="range"
        min={COMMISSION_RATE_MIN}
        max={COMMISSION_RATE_MAX}
        step={COMMISSION_RATE_STEP}
        value={safeValue}
        onChange={(e) => onChange(snapCommissionRate(parseFloat(e.target.value)))}
        className="commission-rate-slider w-full"
        aria-label="Prowizja agencji w procentach"
      />
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-[var(--eos-subtle)]">
        <span>{formatCommissionRate(COMMISSION_RATE_MIN)}</span>
        <span>{formatCommissionRate(COMMISSION_RATE_MAX)}</span>
      </div>
    </div>
  );
}
