"use client";

import { formatPlIntegerInput, parsePlIntegerInput } from "@/lib/plFormattedNumberInput";

type CarFormattedNumberInputProps = {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
};

export default function CarFormattedNumberInput({
  value,
  onChange,
  placeholder,
  className = "",
  required,
  id,
}: CarFormattedNumberInputProps) {
  const display = formatPlIntegerInput(value);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      required={required}
      className={className}
      onChange={(event) => onChange(parsePlIntegerInput(event.target.value))}
    />
  );
}
