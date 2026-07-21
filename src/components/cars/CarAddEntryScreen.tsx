"use client";

import { Camera, FileSearch, Keyboard, Link2, ScanLine, ShieldCheck, Upload } from "lucide-react";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";
import OtomotoImportHeroCard from "@/components/cars/OtomotoImportHeroCard";
import AppleStyleSwitch from "@/components/ui/AppleStyleSwitch";
import { useLocale } from "@/contexts/LocaleContext";
import { useState } from "react";

export type CarAddEntryMethod = "scan" | "upload" | "capture" | "manual" | "otomoto";

type CarAddEntryScreenProps = {
  onChoose: (method: CarAddEntryMethod) => void;
};

type DocMode = "scan" | "upload" | "capture";

export default function CarAddEntryScreen({ onChoose }: CarAddEntryScreenProps) {
  const { dict } = useLocale();
  const c = dict.cars.entry;
  const cat = dict.cars.catalog;
  const [demoRestrict, setDemoRestrict] = useState(true);
  const [docMode, setDocMode] = useState<DocMode>("scan");

  const docModes: { id: DocMode; icon: typeof ScanLine; title: string; description: string }[] = [
    {
      id: "scan",
      icon: ScanLine,
      title: c.docModeLiveTitle,
      description: c.docModeLiveDescription,
    },
    {
      id: "upload",
      icon: Upload,
      title: c.docModeUploadTitle,
      description: c.docModeUploadDescription,
    },
    {
      id: "capture",
      icon: Camera,
      title: c.docModeCaptureTitle,
      description: c.docModeCaptureDescription,
    },
  ];

  return (
    <div className="grid gap-5">
      <CatalogBrandHero brand="car" title={c.heroTitle} description={c.heroDescription} />

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <section className="flex flex-col overflow-hidden rounded-[1.5rem] border border-sky-400/35 bg-[var(--eos-card)] shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
          <div className="flex flex-1 flex-col p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/12">
                <Link2 className="size-5 text-sky-500" aria-hidden />
              </div>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                {c.methodOtomotoBadge}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--eos-text)]">
              {c.methodOtomotoTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{c.methodOtomotoDescription}</p>
          </div>

          <div className="mt-auto border-t border-[var(--eos-border)] px-4 pb-4 pt-3">
            <OtomotoImportHeroCard
              title={cat.otomotoImportTitle}
              body={cat.otomotoImportBody}
              placeholder={cat.otomotoImportPlaceholder}
              cta={cat.otomotoImportCta}
              loadingLabel={cat.otomotoImportLoading}
              redirectTo=""
              compact
              onImported={() => onChoose("otomoto")}
            />
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-[1.5rem] border border-sky-400/35 bg-[var(--eos-card)] shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
          <div className="flex flex-1 flex-col p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/12">
                <ScanLine className="size-5 text-sky-500" aria-hidden />
              </div>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                {c.methodDocBadge}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--eos-text)]">{c.methodDocTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{c.methodDocDescription}</p>
          </div>

          <div className="mt-auto border-t border-[var(--eos-border)] px-4 pb-4 pt-3">
            <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
              {c.docModeLabel}
            </p>
            <div className="grid gap-2">
              {docModes.map((mode) => {
                const active = docMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDocMode(mode.id)}
                    className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                      active
                        ? "border-sky-400/45 bg-sky-500/10 shadow-[0_8px_24px_rgba(14,165,233,0.12)]"
                        : "border-[var(--eos-border)] bg-[var(--eos-surface)] hover:border-sky-400/30"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? "border-sky-500 bg-sky-500" : "border-[var(--eos-border-strong)] bg-transparent"
                      }`}
                      aria-hidden
                    >
                      {active ? <span className="size-2 rounded-full bg-white" /> : null}
                    </span>
                    <mode.icon className={`mt-0.5 size-4 shrink-0 ${active ? "text-sky-500" : "text-[var(--eos-muted)]"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--eos-text)]">{mode.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--eos-muted)]">
                        {mode.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onChoose(docMode)}
              className="mt-3 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.28)] transition hover:bg-sky-400"
            >
              {c.docContinue}
            </button>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_18px_50px_rgba(14,165,233,0.06)]">
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/12">
                <Keyboard className="size-5 text-sky-500" aria-hidden />
              </div>
              <span className="rounded-full bg-[var(--eos-surface)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                {c.methodManualBadge}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--eos-text)]">{c.methodManualTitle}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--eos-muted)]">{c.methodManualDescription}</p>
            <button
              type="button"
              onClick={() => onChoose("manual")}
              className="mt-5 flex w-full items-center justify-center rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-[13px] font-semibold text-sky-700 transition hover:border-sky-400/55 hover:bg-sky-500/15 dark:text-sky-300"
            >
              {c.manualLink}
            </button>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] border border-sky-400/25 bg-gradient-to-br from-sky-500/[0.08] via-[var(--eos-card)] to-[var(--eos-card)] p-4 shadow-[0_18px_50px_rgba(14,165,233,0.08)] sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15">
            <ShieldCheck className="size-5 text-sky-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">{c.privacyEyebrow}</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--eos-text)] sm:text-lg">
              {c.privacyTitle}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--eos-muted)]">
              {c.privacyBody}{" "}
              <strong className="font-semibold text-[var(--eos-text)]">{c.privacyBodyRestrict}</strong>
              {c.privacyBodyHistory}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1">
          <AppleStyleSwitch
            id="demo-restrict-docs"
            checked={demoRestrict}
            onChange={setDemoRestrict}
            label={c.restrictSwitchLabel}
            description={c.restrictSwitchDescription}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
          <FileSearch className="size-4 shrink-0 text-sky-500" aria-hidden />
          <span>{c.restrictHint}</span>
        </div>
      </section>
    </div>
  );
}
