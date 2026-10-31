"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, User } from "lucide-react";

type Settings = { officeAutoPublish: boolean; privateAutoPublish: boolean };

const ROWS: Array<{ key: keyof Settings; label: string; hint: string; icon: typeof Building2 }> = [
  {
    key: "officeAutoPublish",
    label: "Biura bez moderacji",
    hint: "Ogłoszenia biur (zatwierdzone przez kierownika lub z kredytów agenta) od razu na rynku.",
    icon: Building2,
  },
  {
    key: "privateAutoPublish",
    label: "Prywatne bez moderacji",
    hint: "Ogłoszenia osób prywatnych od razu na rynku, bez kolejki Weryfikacja.",
    icon: User,
  },
];

/** Dwa włączniki publikacji bez moderacji EstateOS™. */
export default function AdminModerationToggles() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState<keyof Settings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/moderation-settings", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.success ? setSettings(j.settings) : setError("Nie udało się wczytać ustawień moderacji.")))
      .catch(() => setError("Nie udało się wczytać ustawień moderacji."));
  }, []);

  const toggle = async (key: keyof Settings) => {
    if (!settings) return;
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/admin/moderation-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !settings[key] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) throw new Error();
      setSettings(j.settings);
    } catch {
      setError("Nie udało się zapisać.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-4 grid gap-2 sm:grid-cols-2">
      {ROWS.map(({ key, label, hint, icon: Icon }) => {
        const on = Boolean(settings?.[key]);
        return (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={!settings || busy != null}
            onClick={() => void toggle(key)}
            className="flex items-center gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 text-left transition-colors hover:border-[#a8844c]/45 disabled:opacity-60"
          >
            <Icon className="size-4 shrink-0 text-[var(--eos-muted)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[var(--eos-text)]">{label}</span>
              <span className="block text-[11.5px] leading-snug text-[var(--eos-muted)]">{hint}</span>
            </span>
            {busy === key ? <Loader2 className="size-4 animate-spin text-[var(--eos-muted)]" /> : null}
            <span
              aria-hidden
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-[#a8844c] bg-[#a8844c]" : "border-[var(--eos-border)] bg-[var(--eos-bg)]"}`}
            >
              <span className={`absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>
        );
      })}
      {error ? <p className="text-[12px] text-red-600 sm:col-span-2">{error}</p> : null}
    </section>
  );
}
