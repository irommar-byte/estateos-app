"use client";

type AppleStyleSwitchProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  accent?: "sky" | "emerald";
};

export default function AppleStyleSwitch({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  accent = "sky",
}: AppleStyleSwitchProps) {
  const trackOn = accent === "sky" ? "bg-sky-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" : "bg-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]";
  const trackOff = "bg-neutral-300 dark:bg-[var(--eos-border-strong)]";

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition-colors sm:px-5 ${
        checked
          ? "border-sky-400/35 bg-sky-500/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border-[var(--eos-border)] bg-[var(--eos-bg)]/35"
      } ${disabled ? "opacity-55" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p id={`${id}-label`} className="text-sm font-semibold tracking-tight text-[var(--eos-text)]">
          {label}
        </p>
        {description ? (
          <p id={`${id}-desc`} className="mt-1.5 text-xs leading-relaxed text-[var(--eos-muted)]">
            {description}
          </p>
        ) : null}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-[52px] flex-shrink-0 rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--eos-card)] ${
          checked ? trackOn : trackOff
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}`}
      >
        <span
          aria-hidden
          className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.22)] transition-transform duration-200 ease-out ${
            checked ? "translate-x-[22px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
