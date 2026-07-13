import type { ReactNode } from "react";

export const carFieldLabelClass =
  "text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]";

export const carFieldInputClass =
  "w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3.5 py-2.5 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-sky-400/55 focus:ring-2 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const carSectionShellClass =
  "overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_22px_70px_rgba(14,165,233,0.08)]";

export const carSectionHeaderClass =
  "border-b border-[var(--eos-border)] bg-gradient-to-r from-sky-500/[0.07] via-transparent to-cyan-500/[0.04] px-5 py-4 sm:px-6";

type CarFormSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function CarFormSection({ eyebrow, title, description, children }: CarFormSectionProps) {
  return (
    <section className={carSectionShellClass}>
      <div className={carSectionHeaderClass}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--eos-text)]">{title}</h2>
        {description ? <p className="mt-1 text-xs text-[var(--eos-muted)]">{description}</p> : null}
      </div>
      <div className="grid gap-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function CarFormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className={carFieldLabelClass}>{label}</span>
      {children}
    </label>
  );
}
