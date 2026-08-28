'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BUYER_SUGGEST_MIN_CHARS } from '@/lib/buyerIntakeShared';

export type BuyerSuggestOption = {
  id: string;
  label: string;
  value: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  suggestions: BuyerSuggestOption[];
  loading?: boolean;
  minChars?: number;
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function BuyerSuggestInput({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  suggestions,
  loading = false,
  minChars = BUYER_SUGGEST_MIN_CHARS,
  compact = false,
  ariaLabel,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const trimmed = value.trim();
  const showList = open && trimmed.length >= minChars && (loading || suggestions.length > 0);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (trimmed.length >= minChars) {
      setOpen(true);
      return;
    }
    setOpen(false);
  }, [trimmed, minChars, suggestions.length, loading]);

  return (
    <div ref={wrapRef} className={`relative ${className}`.trim()}>
      <input
        type="text"
        value={value}
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        role="combobox"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (trimmed.length >= minChars && (loading || suggestions.length > 0)) {
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        className={`bi-city-input w-full rounded-xl border px-3 outline-none ${compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px] sm:py-2'} ${trimmed ? 'bi-city-input--active' : ''}`}
        maxLength={128}
        disabled={disabled}
      />
      {loading ? (
        <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-emerald-500" />
      ) : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="bi-suggest-list absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border py-1 shadow-lg"
        >
          {suggestions.map((item) => (
            <li key={item.id} role="presentation">
              <button
                type="button"
                role="option"
                className="bi-suggest-list__item w-full px-3 py-2 text-left text-[12px] font-medium sm:text-[13px]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">Szukam…</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
