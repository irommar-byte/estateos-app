"use client";

import { Camera, FileSearch, Keyboard, ScanLine, ShieldCheck, Upload } from "lucide-react";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";
import AppleStyleSwitch from "@/components/ui/AppleStyleSwitch";
import { useLocale } from "@/contexts/LocaleContext";
import { useMemo, useState } from "react";

export type CarAddEntryMethod = "scan" | "upload" | "capture" | "manual";

type CarAddEntryScreenProps = {
  onChoose: (method: CarAddEntryMethod) => void;
};

export default function CarAddEntryScreen({ onChoose }: CarAddEntryScreenProps) {
  const { dict } = useLocale();
  const c = dict.cars.entry;
  const [demoRestrict, setDemoRestrict] = useState(true);

  const methods = useMemo(
    () =>
      [
        {
          id: "scan" as const,
          icon: ScanLine,
          title: c.methodScanTitle,
          description: c.methodScanDescription,
          badge: c.methodScanBadge,
        },
        {
          id: "upload" as const,
          icon: Upload,
          title: c.methodUploadTitle,
          description: c.methodUploadDescription,
        },
        {
          id: "capture" as const,
          icon: Camera,
          title: c.methodCaptureTitle,
          description: c.methodCaptureDescription,
        },
        {
          id: "manual" as const,
          icon: Keyboard,
          title: c.methodManualTitle,
          description: c.methodManualDescription,
        },
      ] as const,
    [c],
  );

  return (
    <div className="grid gap-6">
      <CatalogBrandHero brand="car" title={c.heroTitle} description={c.heroDescription} />

      <section className="overflow-hidden rounded-[1.75rem] border border-sky-400/25 bg-gradient-to-br from-sky-500/[0.08] via-[var(--eos-card)] to-[var(--eos-card)] p-5 shadow-[0_22px_70px_rgba(14,165,233,0.1)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15">
            <ShieldCheck className="size-5 text-sky-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">{c.privacyEyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--eos-text)]">{c.privacyTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              {c.privacyBody}{" "}
              <strong className="font-semibold text-[var(--eos-text)]">{c.privacyBodyRestrict}</strong>
              {c.privacyBodyHistory}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1">
          <AppleStyleSwitch
            id="demo-restrict-docs"
            checked={demoRestrict}
            onChange={setDemoRestrict}
            label={c.restrictSwitchLabel}
            description={c.restrictSwitchDescription}
          />
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
          <FileSearch className="size-4 shrink-0 text-sky-500" aria-hidden />
          <span>{c.restrictHint}</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onChoose(method.id)}
            className="group flex h-full flex-col rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 text-left shadow-[0_18px_50px_rgba(14,165,233,0.05)] transition hover:border-sky-400/35 hover:shadow-[0_22px_60px_rgba(14,165,233,0.12)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/12 transition group-hover:bg-sky-500/18">
                <method.icon className="size-5 text-sky-500" aria-hidden />
              </div>
              {"badge" in method && method.badge ? (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                  {method.badge}
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight text-[var(--eos-text)]">{method.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--eos-muted)]">{method.description}</p>
            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-sky-600 transition group-hover:text-sky-500 dark:text-sky-400">
              {dict.cars.common.choose}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
