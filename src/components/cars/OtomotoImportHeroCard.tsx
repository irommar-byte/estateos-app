"use client";

import { useCallback, useState } from "react";
import { ArrowRight, Link2, Loader2 } from "lucide-react";
import {
  isSupportedOtomotoOfferUrl,
  OTOMOTO_IMPORT_STORAGE_KEY,
  type OtomotoCarImportPrefill,
} from "@/lib/otomotoCarImport";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";

type OtomotoImportHeroCardProps = {
  title: string;
  body: string;
  placeholder: string;
  cta: string;
  loadingLabel: string;
  onImported?: (payload: {
    prefill: OtomotoCarImportPrefill;
    missingFields: CarListingMissingFieldKey[];
  }) => void;
  /** When set, navigate here after successful import (stores payload in sessionStorage). */
  redirectTo?: string;
  compact?: boolean;
};

export default function OtomotoImportHeroCard({
  title,
  body,
  placeholder,
  cta,
  loadingLabel,
  onImported,
  redirectTo = "/cars/dodaj?from=otomoto",
  compact = false,
}: OtomotoImportHeroCardProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runImport = useCallback(async () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Wklej link do ogłoszenia Otomoto.");
      return;
    }
    if (!isSupportedOtomotoOfferUrl(trimmed)) {
      setError("Potrzebujemy bezpośredniego linku Otomoto z /oferta/…");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/cars/otomoto-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        prefill?: OtomotoCarImportPrefill;
        missingFields?: CarListingMissingFieldKey[];
      };
      if (!response.ok || !data.prefill) {
        throw new Error(data.error || "Nie udało się przenieść ogłoszenia z Otomoto.");
      }

      const payload = {
        prefill: data.prefill,
        missingFields: data.missingFields || [],
        importedAt: Date.now(),
      };
      try {
        sessionStorage.setItem(OTOMOTO_IMPORT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore quota */
      }

      onImported?.(payload);
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import z Otomoto nie powiódł się.");
    } finally {
      setLoading(false);
    }
  }, [onImported, redirectTo, url]);

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/[0.09] via-[var(--eos-surface)] to-[var(--eos-surface)] ${
        compact ? "p-4" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
          <Link2 className="size-4 text-sky-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">Otomoto → EstateOS™Car</p>
          <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--eos-text)] sm:text-base">
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--eos-muted)]">{body}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <label className="sr-only" htmlFor="otomoto-import-url">
          Link Otomoto
        </label>
        <input
          id="otomoto-import-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          disabled={loading}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void runImport();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3.5 py-3 text-sm text-[var(--eos-text)] outline-none transition placeholder:text-[var(--eos-muted)] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/25 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void runImport()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.28)] transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {loadingLabel}
            </>
          ) : (
            <>
              {cta}
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
