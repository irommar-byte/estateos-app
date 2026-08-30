"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { IntelligenceSettings } from "@/lib/crm/clientIntelligence";
import {
  DEFAULT_INTELLIGENCE_SETTINGS,
  INTELLIGENCE_DAILY_LIMIT_OPTIONS,
  INTELLIGENCE_INTERVAL_OPTIONS,
  INTELLIGENCE_MIN_LEARNS_OPTIONS,
  INTELLIGENCE_MIN_SCORE_OPTIONS,
} from "@/lib/crm/clientIntelligence";
import type { IntelligencePick } from "@/lib/crm/clientIntelligenceRun";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import EosGlowSelect from "@/components/crm/EosGlowSelect";

const BUBBLES = [
  { color: "#ff4d6d", size: 118, x: "8%", y: "72%", delay: "0s", duration: "11s" },
  { color: "#ffd166", size: 86, x: "78%", y: "8%", delay: "1.2s", duration: "13s" },
  { color: "#06d6a0", size: 96, x: "62%", y: "68%", delay: "0.4s", duration: "10s" },
  { color: "#4cc9f0", size: 74, x: "18%", y: "12%", delay: "2s", duration: "14s" },
  { color: "#c77dff", size: 108, x: "88%", y: "48%", delay: "0.8s", duration: "12s" },
  { color: "#ff9f1c", size: 64, x: "42%", y: "82%", delay: "1.6s", duration: "9s" },
  { color: "#80ffdb", size: 52, x: "52%", y: "18%", delay: "2.4s", duration: "15s" },
  { color: "#ff70a6", size: 70, x: "4%", y: "42%", delay: "0.6s", duration: "11s" },
];

export type IntelligenceActivity = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: string;
};

const INTEL_HISTORY_KINDS = new Set([
  "INTELLIGENCE_OFFER",
  "INTELLIGENCE_PLANNED",
  "INTELLIGENCE_TASTE",
  "FEEDBACK_REMINDER",
  "CLIENT_NOTIFIED",
  "CLIENT_FEEDBACK",
  "OFFER_SHARED",
  "PORTAL_HUNT",
]);

function IosRainbowSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || "Włącz tęczowego asystenta"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`eos-intel-switch ${checked ? "is-on" : ""} ${disabled ? "opacity-50" : ""}`}
    >
      {checked ? (
        <span className="eos-intel-switch__orbs" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      ) : null}
      <span className="eos-intel-switch__knob" />
    </button>
  );
}

function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - 75) / 20));
  const hue = 8 + t * 127;
  return `hsl(${hue} 82% 46%)`;
}

function scoreGuide(score: number): { title: string; body: string; worth: string } {
  if (score <= 75) {
    return {
      title: "Więcej propozycji",
      body: "Próg 75% puszcza też oferty „prawie pasuje”. Klient dostanie więcej maili, a mózg szybciej zbierze obiekcje.",
      worth: "Opłaca się na starcie albo gdy radar jest bardzo wąski i kolejka stoi pusta.",
    };
  }
  if (score <= 80) {
    return {
      title: "Zrównoważone",
      body: "80% odcina słabe trafienia, ale nie czeka na niemal idealne dopasowanie. To bezpieczny kompromis między ilością a jakością.",
      worth: "Najczęściej się opłaca, gdy klient już raz-dwa zareagował na oferty.",
    };
  }
  if (score <= 85) {
    return {
      title: "Pewniej",
      body: "85% zostawia tylko mocniejsze dopasowania. Mniej szumu w skrzynce, wolniejsza nauka.",
      worth: "Warto, gdy klient jest wybredny albo agent nie chce wysyłać „na wszelki wypadek”.",
    };
  }
  if (score <= 92) {
    return {
      title: "Tylko pewne",
      body: "92% to domyślna ostrożność: mózg koryguje wynik radaru, a ten próg nadal odcina wszystko poniżej.",
      worth: "Opłaca się przy spokojnym cyklu. Nie opłaca się, jeśli chcesz szybko nauczyć ankietę z reakcji.",
    };
  }
  return {
    title: "Bardzo ostrożnie",
    body: "95% puszcza wyłącznie niemal idealne trafienia. Przy braku reakcji kalibracja i tak wyśle pakiet z radaru, ale potem kolejka może milczeć.",
    worth: "Włączaj dopiero gdy ankieta i reakcje są już ostre. Na starcie zwykle za ciasno.",
  };
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CrmIntelligenceAssistant({
  clientId,
  value,
  busy,
  activities,
  onSave,
}: {
  clientId: number;
  value?: IntelligenceSettings | null;
  busy?: boolean;
  activities?: IntelligenceActivity[];
  onSave: (next: IntelligenceSettings) => void | boolean | Promise<unknown>;
}) {
  const [draft, setDraft] = useState<IntelligenceSettings>(value || DEFAULT_INTELLIGENCE_SETTINGS);
  const [pick, setPick] = useState<IntelligencePick | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [blooming, setBlooming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [sendNote, setSendNote] = useState("");
  const [huntBusy, setHuntBusy] = useState<"preview" | "import" | null>(null);
  const [huntNote, setHuntNote] = useState("");
  const [huntHits, setHuntHits] = useState<
    Array<{
      url: string;
      title: string;
      price: number | null;
      area: number | null;
      rooms: number | null;
      city: string | null;
      street: string | null;
      alreadyImported?: boolean;
    }>
  >([]);
  const enabledRef = useRef(Boolean(value?.enabled));

  useEffect(() => {
    setDraft(value || DEFAULT_INTELLIGENCE_SETTINGS);
  }, [value]);

  useEffect(() => {
    if (draft.enabled && !enabledRef.current) {
      setBlooming(true);
      const timer = window.setTimeout(() => setBlooming(false), 900);
      enabledRef.current = true;
      return () => window.clearTimeout(timer);
    }
    enabledRef.current = draft.enabled;
    return undefined;
  }, [draft.enabled]);

  useEffect(() => {
    let cancelled = false;
    setQueueBusy(true);
    fetch(`/api/crm/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "intelligence_preview" }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.pick) setPick(json.pick as IntelligencePick);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setQueueBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, value?.lastSentAt, value?.enabled, value?.minScore, value?.minLearns, value?.intervalHours]);

  const nextWhen = formatWhen(pick?.nextSendAt);
  const guide = scoreGuide(draft.minScore);
  const scoreAccent = scoreColor(draft.minScore);
  const knobLeft = `${Math.max(0, Math.min(100, ((draft.minScore - 75) / 20) * 100))}%`;

  const intelHistory = useMemo(() => {
    return (activities || []).filter((item) => INTEL_HISTORY_KINDS.has(item.kind)).slice(0, 6);
  }, [activities]);

  const nowLines = useMemo(() => {
    if (!draft.enabled) return ["Asystent jest wyłączony — nic nie wyjdzie, kolejka tylko podgląda."];
    if (queueBusy) return ["Analizuję opisy, ankietę i reakcje…"];
    if (pick?.ready && pick.title) {
      return [
        `Teraz: kolejka gotowa — ${pick.title}.`,
        pick.calibrating ? "Tryb kalibracji: brak reakcji, więc idzie najlepsze z radaru." : `Pewność ${pick.score ?? "—"}%.`,
      ];
    }
    return [pick?.skipReason || "Czeka na kolejny cykl albo reakcję klienta."];
  }, [draft.enabled, pick, queueBusy]);

  const plannedLines = useMemo(() => {
    const interval = INTELLIGENCE_INTERVAL_OPTIONS.find((item) => item.value === draft.intervalHours)?.label || `${draft.intervalHours} godz.`;
    return [
      `Gdy cykl minie, wyślę do ${draft.dailyLimit} ${draft.dailyLimit === 1 ? "oferty" : "ofert"} naraz.`,
      nextWhen ? `Następna próba: ${nextWhen}.` : "Brak zaplanowanej godziny — włącz asystenta albo zbierz reakcje.",
      pick?.title ? `W kolejce: ${pick.title}.` : "Brak kandydata w kolejce.",
    ];
  }, [draft.dailyLimit, draft.intervalHours, nextWhen, pick?.title]);

  const recommendedLines = useMemo(() => {
    const lines: string[] = [];
    if (!draft.enabled) lines.push("Włącz asystenta, zapisz, i daj mu jeden cykl — inaczej nic nie wyśle.");
    if (draft.enabled && (pick?.learnCount || 0) === 0) {
      lines.push("Brak reakcji: zostaw kalibrację, potem zejdź do 80%, jeśli 92% będzie za pusto.");
    }
    if (draft.minScore >= 95 && (pick?.learnCount || 0) < 3) {
      lines.push("95% na starcie zwykle nie opłaca się — za mało nauki, za cicha skrzynka.");
    }
    if (draft.minScore <= 75 && (pick?.learnCount || 0) >= 3) {
      lines.push("Po kilku reakcjach warto podnieść próg do 85–92%, żeby nie zasypywać klienta.");
    }
    if (pick?.ready) lines.push("Kolejka jest gotowa — po zapisie asystent wyśle przy najbliższym tiku.");
    if (!lines.length) lines.push("Ustawienia wyglądają spójnie. Zostaw cykl i zbieraj reakcje.");
    return lines;
  }, [draft.enabled, draft.minScore, pick?.learnCount, pick?.ready]);

  const handleSave = async () => {
    setSaved(false);
    try {
      const result = await onSave(draft);
      if (result === false) return;
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch {
      setSaved(false);
    }
  };

  const refreshPick = async () => {
    const res = await fetch(`/api/crm/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "intelligence_preview" }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.pick) setPick(json.pick as IntelligencePick);
  };

  const handleSendNow = async () => {
    setSendingNow(true);
    setSendNote("");
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "intelligence_send" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Nie udało się wysłać."));
      if (json.sent) {
        setSendNote(json.emailSent ? "Wysłane teraz — klient dostał maila." : "Wysłane teraz — propozycja jest w panelu.");
      } else {
        setSendNote(json.pick?.skipReason || "Nic nie poszło — brak gotowego kandydata.");
      }
      await refreshPick();
    } catch (error) {
      setSendNote(error instanceof Error ? error.message : "Nie udało się wysłać.");
    } finally {
      setSendingNow(false);
    }
  };

  const runPortalHunt = async (mode: "preview" | "import") => {
    setHuntBusy(mode);
    setHuntNote(mode === "preview" ? "Szukam na Nieruchomości-Online według ankiety…" : "Importuję z portalu i podaję mózgowi…");
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal_hunt", mode, send: mode === "import" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Nie udało się przeszukać portalu."));
      if (Array.isArray(json.hits)) setHuntHits(json.hits.slice(0, 8));
      setHuntNote(String(json.message || "Gotowe."));
      if (json.pick) setPick(json.pick as IntelligencePick);
      if (mode === "import") await refreshPick();
    } catch (error) {
      setHuntNote(error instanceof Error ? error.message : "Nie udało się przeszukać Nieruchomości-Online.");
    } finally {
      setHuntBusy(null);
    }
  };

  return (
    <div className={`eos-intel-shell ${draft.enabled ? "is-on" : ""} ${blooming ? "is-blooming" : ""}`}>
      <div className="eos-intel-bubbles" aria-hidden>
        {BUBBLES.map((bubble) => (
          <span
            key={`${bubble.color}-${bubble.x}`}
            className="eos-intel-bubble"
            style={{
              background: bubble.color,
              width: bubble.size,
              height: bubble.size,
              left: bubble.x,
              top: bubble.y,
              animationDelay: bubble.delay,
              animationDuration: bubble.duration,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="eos-intel-kicker text-[10px] font-black uppercase tracking-[0.16em]">
              Tęczowy asystent · EstateOS™ Intelligence
            </p>
            <p className="mt-1 text-sm text-[var(--eos-text)]/80">
              Uczy się z reakcji klienta (oglądać / przemyśleć / odłóż + obiekcje) i po kilku próbach sam wysyła
              jedną pewną propozycję w Twoim imieniu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--eos-text)]">
              {draft.enabled ? "Włączony" : "Wyłączony"}
            </span>
            <IosRainbowSwitch
              checked={draft.enabled}
              disabled={busy}
              onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]">
              Inteligentne dodawanie
            </p>
            <p className="mt-1 text-xs leading-snug text-[var(--eos-text)]/75">
              Przy każdym imporcie automatycznie zaznacza balkon, windę, parking, klimatyzację, umeblowanie,
              ogrzewanie i resztę parametrów wykrytych w opisie portalu. Zmiany widać na ofercie i można cofnąć.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
            Zawsze włączone
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <EosGlowSelect
            label="Interwał"
            hint="Jak często asystent wraca do kolejki."
            value={draft.intervalHours}
            options={INTELLIGENCE_INTERVAL_OPTIONS}
            onChange={(intervalHours) => setDraft((current) => ({ ...current, intervalHours }))}
          />
          <EosGlowSelect
            label="Ofert na cykl"
            hint="Limit na jeden cykl: jak minie interwał, wyśle do N ofert naraz — nie codziennie po jednej."
            value={draft.dailyLimit}
            options={INTELLIGENCE_DAILY_LIMIT_OPTIONS}
            onChange={(dailyLimit) => setDraft((current) => ({ ...current, dailyLimit }))}
          />
          <EosGlowSelect
            label="Ile reakcji zanim wyśle"
            hint="Przy braku reakcji asystent i tak wyśle pakiet kalibracyjny z radaru."
            value={draft.minLearns}
            options={INTELLIGENCE_MIN_LEARNS_OPTIONS}
            onChange={(minLearns) => setDraft((current) => ({ ...current, minLearns }))}
          />
          <div>
            <EosGlowSelect
              label="Minimalna pewność"
              hint="Próg wysyłki po ankiecie i nauce. Mózg tylko koryguje wynik — ten próg nadal odcina słabe trafienia."
              value={draft.minScore}
              options={INTELLIGENCE_MIN_SCORE_OPTIONS}
              accent={scoreAccent}
              optionAccent={scoreColor}
              onChange={(minScore) => setDraft((current) => ({ ...current, minScore }))}
            />
            <div className="eos-intel-score mt-3">
              <div className="eos-intel-score__track" aria-hidden>
                <span className="eos-intel-score__knob" style={{ left: knobLeft, ["--eos-glow" as string]: scoreAccent }} />
              </div>
              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: scoreAccent }}>
                {draft.minScore}% · {guide.title}
              </p>
              <p className="mt-1 text-xs leading-snug text-[var(--eos-text)]/80">{guide.body}</p>
              <p className="mt-1 text-xs font-semibold leading-snug text-[var(--eos-text)]">{guide.worth}</p>
            </div>
          </div>
        </div>

        {draft.enabled ? (
          <div className="eos-intel-console">
            <p className="eos-intel-kicker inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
              <Sparkles className="size-3.5" />
              Konsola asystenta
            </p>
            <div className="eos-intel-console__grid">
              <section>
                <h4>Teraz</h4>
                <ul>
                  {nowLines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>Zaplanowane</h4>
                <ul>
                  {plannedLines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>Historia</h4>
                <ul>
                  {intelHistory.length ? (
                    intelHistory.map((item) => (
                      <li key={item.id}>
                        • {item.title || "Zdarzenie"}{" "}
                        <span className="text-[var(--eos-muted)]">
                          · {new Date(item.createdAt).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li>• Brak jeszcze wysyłek ani dopisek z reakcji.</li>
                  )}
                  {draft.lastSentAt ? (
                    <li>• Ostatni domysł: {new Date(draft.lastSentAt).toLocaleString("pl-PL")}</li>
                  ) : null}
                </ul>
              </section>
              <section>
                <h4>Polecane</h4>
                <ul>
                  {recommendedLines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        ) : null}

        <div className="eos-intel-queue eos-intel-ledger rounded-2xl p-3">
          <p className="eos-intel-ledger__title">Następne w kolejce</p>
          {queueBusy ? (
            <p className="mt-2 text-sm text-[var(--eos-muted)]">Analizuję opisy i reakcje…</p>
          ) : pick?.offerId ? (
            <>
              <p className="eos-intel-ledger__next">{pick.title}</p>
              <p className="eos-intel-ledger__meta">
                {[pick.city, pick.district].filter(Boolean).join(" · ")}
                {pick.price ? ` · ${Math.round(pick.price).toLocaleString("pl-PL")} zł` : ""}
                {pick.area ? ` · ${pick.area} m²` : ""}
                {pick.score != null ? ` · ${pick.score}%` : ""}
              </p>
              <p className="eos-intel-ledger__meta">
                {pick.ready
                  ? `${pick.calibrating ? "Kalibracja · " : ""}Wyślę przy cyklu${nextWhen ? ` · ${nextWhen}` : ""}`
                  : pick.skipReason
                    ? `${pick.skipReason}${nextWhen ? ` · ${nextWhen}` : ""}`
                    : nextWhen
                      ? `Plan: ${nextWhen}`
                      : "Czeka na cykl albo reakcje."}
              </p>
              {(pick.lessons || []).length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Wysłane</th>
                      <th>Reakcja klienta</th>
                      <th>Vs ta oferta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pick.lessons.map((lesson) => (
                      <tr key={lesson.offerId}>
                        <td>
                          {lesson.title}
                          {lesson.when ? (
                            <span className="eos-intel-ledger__said">
                              {" "}
                              · {new Date(lesson.when).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ) : null}
                        </td>
                        <td className="eos-intel-ledger__said">{lesson.said}</td>
                        <td className="eos-intel-ledger__vs">{lesson.vsNext || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-[0.8rem] leading-snug text-[var(--eos-text)]/80">
                  {(pick.analysis?.length ? pick.analysis : pick.reasons).slice(0, 3).join(" · ") ||
                    "Brak jeszcze wysyłek do porównania."}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--eos-muted)]">
              {pick?.skipReason || "Brak jeszcze kandydata. Potrzeba reakcji klienta albo niewysłanych trafień radaru."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className={`${eosBtn("home", { size: "sm" })} eos-intel-save ${saved ? "is-saved" : ""}`}
          >
            {busy ? (
              "Zapisuję…"
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5" />
                Zapisany
              </span>
            ) : (
              "Zapisz asystenta i ankietę"
            )}
          </button>
          <button
            type="button"
            disabled={busy || sendingNow || !pick?.offerId}
            onClick={() => void handleSendNow()}
            className={eosBtn("ghost", { size: "sm" })}
          >
            {sendingNow ? "Wysyłam…" : "Wyślij teraz"}
          </button>
          <button
            type="button"
            disabled={busy || sendingNow || huntBusy != null}
            onClick={() => void runPortalHunt("preview")}
            className={eosBtn("ghost", { size: "sm" })}
          >
            {huntBusy === "preview" ? "Szukam…" : "Szukaj na N-O"}
          </button>
          <button
            type="button"
            disabled={busy || sendingNow || huntBusy != null}
            onClick={() => void runPortalHunt("import")}
            className={eosBtn("ghost", { size: "sm" })}
          >
            {huntBusy === "import" ? "Importuję…" : "Importuj i wyślij"}
          </button>
        </div>
        {sendNote ? <p className="text-xs font-semibold text-[var(--eos-text)]/80">{sendNote}</p> : null}
        {huntNote ? <p className="text-xs font-semibold text-[var(--eos-text)]/80">{huntNote}</p> : null}
        {huntHits.length ? (
          <ul className="space-y-1.5 text-xs text-[var(--eos-text)]/85">
            {huntHits.map((hit) => (
              <li key={hit.url} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                <p className="font-semibold leading-snug">{hit.title}</p>
                <p className="mt-0.5 opacity-80">
                  {[
                    hit.city,
                    hit.street,
                    hit.price != null ? `${hit.price.toLocaleString("pl-PL")} zł` : null,
                    hit.area != null ? `${hit.area} m²` : null,
                    hit.rooms != null ? `${hit.rooms} pok.` : null,
                    hit.alreadyImported ? "już w EstateOS" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
