'use client';

import { useMemo, useState } from 'react';
import {
  COMMISSION_RATE_DEFAULT,
  COMMISSION_RATE_MAX,
  COMMISSION_RATE_MIN,
  COMMISSION_RATE_STEP,
  commissionAmountFromRate,
  commissionAmountStep,
  commissionRateFromAmount,
  formatCommissionAmount,
  formatCommissionRate,
  snapCommissionAmount,
  snapCommissionRate,
} from '@/lib/leadTransferShared';

type CommissionMode = 'percent' | 'amount';

type Props = {
  value: number;
  onChange: (value: number) => void;
  offerPrice: number;
  className?: string;
};

export default function CommissionRateSlider({
  value,
  onChange,
  offerPrice,
  className = '',
}: Props) {
  const [mode, setMode] = useState<CommissionMode>('percent');
  const safeRate = snapCommissionRate(Number.isFinite(value) ? value : COMMISSION_RATE_DEFAULT);
  const price = Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : 0;
  const amount = commissionAmountFromRate(price, safeRate);
  const amountModeAvailable = price > 0;

  const sliderConfig = useMemo(() => {
    if (mode === 'percent') {
      return {
        min: COMMISSION_RATE_MIN,
        max: COMMISSION_RATE_MAX,
        step: COMMISSION_RATE_STEP,
        value: safeRate,
      };
    }
    return {
      min: 0,
      max: price,
      step: commissionAmountStep(price),
      value: snapCommissionAmount(price, amount),
    };
  }, [amount, mode, price, safeRate]);

  const sliderFill =
    sliderConfig.max > sliderConfig.min
      ? ((sliderConfig.value - sliderConfig.min) / (sliderConfig.max - sliderConfig.min)) * 100
      : 0;

  const applySliderValue = (raw: number) => {
    if (mode === 'percent') {
      onChange(snapCommissionRate(raw));
      return;
    }
    onChange(commissionRateFromAmount(price, snapCommissionAmount(price, raw)));
  };

  const applyInputText = (text: string) => {
    const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
    if (!normalized || normalized === '.') return;
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed)) return;
    if (mode === 'percent') {
      onChange(snapCommissionRate(parsed));
      return;
    }
    onChange(commissionRateFromAmount(price, snapCommissionAmount(price, parsed)));
  };

  const inputValue =
    mode === 'percent'
      ? safeRate.toFixed(1).replace('.', ',')
      : String(snapCommissionAmount(price, amount));

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
            Prowizja agencji
          </p>
          <p className="mt-1 text-xs text-[var(--eos-subtle)]">
            {formatCommissionRate(safeRate)}
            {amountModeAvailable ? (
              <span className="text-[var(--eos-muted)]"> · {formatCommissionAmount(amount)}</span>
            ) : null}
          </p>
        </div>
        <div className="flex rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-0.5">
          <button
            type="button"
            onClick={() => setMode('percent')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
              mode === 'percent'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'
            }`}
          >
            %
          </button>
          <button
            type="button"
            disabled={!amountModeAvailable}
            onClick={() => amountModeAvailable && setMode('amount')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
              mode === 'amount'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)] disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            zł
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => applyInputText(e.target.value)}
          className="w-28 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-right text-sm font-bold text-[var(--eos-text)]"
          aria-label={mode === 'percent' ? 'Prowizja w procentach' : 'Prowizja w złotych'}
        />
        <span className="text-xs font-semibold text-[var(--eos-muted)]">
          {mode === 'percent' ? '%' : 'zł'}
        </span>
      </div>

      <div className="commission-rate-slider-wrap">
        <div
          className="commission-rate-slider-fill"
          style={{ width: `${sliderFill}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={sliderConfig.min}
          max={sliderConfig.max}
          step={sliderConfig.step}
          value={sliderConfig.value}
          onChange={(e) => applySliderValue(parseFloat(e.target.value))}
          className="commission-rate-slider"
          aria-label={
            mode === 'percent' ? 'Prowizja agencji w procentach' : 'Prowizja agencji w złotych'
          }
        />
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-semibold text-[var(--eos-subtle)]">
        {mode === 'percent' ? (
          <>
            <span>{formatCommissionRate(COMMISSION_RATE_MIN)}</span>
            <span>{formatCommissionRate(COMMISSION_RATE_MAX)}</span>
          </>
        ) : (
          <>
            <span>{formatCommissionAmount(0)}</span>
            <span>{formatCommissionAmount(price)}</span>
          </>
        )}
      </div>
    </div>
  );
}
