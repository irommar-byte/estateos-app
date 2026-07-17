import type { ReactNode } from "react";

export const carFieldLabelClass =
  "text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]";

export const carFieldInputClass =
  "w-full rounded-xl border-2 border-slate-300/90 bg-[var(--eos-input,#f3f3f1)] px-3.5 py-2.5 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-[var(--eos-muted)] focus:border-sky-400 focus:bg-[var(--eos-surface-strong,#fff)] focus:ring-2 focus:ring-sky-400/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/25 dark:bg-[var(--eos-input,#1e1e22)]";

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

export const carAlertInfoClass =
  "rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-100";

export const carAlertWarningClass =
  "rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50";

export const carAlertErrorClass =
  "rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300";

export const carAlertSuccessClass =
  "rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200";

export const carOverlayBackdropClass = "fixed inset-0 z-[80] bg-[var(--eos-bg)]/85 backdrop-blur-md";

export const carModalPanelClass =
  "relative overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_28px_90px_rgba(0,0,0,0.35)]";

export const carSelectClass = `${carFieldInputClass} appearance-none`;

export function CarFormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className={carFieldLabelClass}>{label}</span>
      {children}
    </label>
  );
}
