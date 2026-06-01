"use client";

import { Check } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  boxClassName?: string;
};

/** Widoczny checkbox (estate-checkbox) — działa w light i dark. */
export default function EosCheckbox({
  label,
  checked,
  onCheckedChange,
  id: idProp,
  className = "",
  boxClassName = "",
  disabled,
  ...rest
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-4 text-left transition-colors hover:bg-[var(--eos-surface)] ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
    >
      <span
        className={`estate-checkbox eos-form-checkbox mt-0.5 shrink-0 ${checked ? "checked" : ""} ${boxClassName}`}
        aria-hidden
      >
        <Check size={16} strokeWidth={4} />
      </span>
      <input
        {...rest}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="sr-only"
      />
      <span className="text-[13px] leading-relaxed text-[var(--eos-muted)]">{label}</span>
    </label>
  );
}
