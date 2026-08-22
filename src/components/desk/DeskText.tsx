'use client';

import type { ReactNode } from 'react';

/** Truncated text with native tooltip for long values in tight Desk layouts. */
export function DeskTruncate({
  children,
  className = '',
  lines = 2,
  title,
}: {
  children: ReactNode;
  className?: string;
  lines?: 1 | 2 | 3;
  title?: string;
}) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  return (
    <span
      className={`eos-desk-truncate eos-desk-truncate--${lines} ${className}`.trim()}
      title={title ?? (text.length > 24 ? text : undefined)}
    >
      {children}
    </span>
  );
}

export function DeskField({
  label,
  value,
  emphasis,
  children,
}: {
  label: string;
  value?: ReactNode;
  emphasis?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="eos-desk-field">
      <span className="eos-desk-command-label">{label}</span>
      {children ?? (
        <DeskTruncate className={emphasis ? 'eos-desk-field-value--emphasis' : 'eos-desk-field-value'} lines={2}>
          {value ?? '—'}
        </DeskTruncate>
      )}
    </div>
  );
}
