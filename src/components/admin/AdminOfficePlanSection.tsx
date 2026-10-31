"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Minus, Plus } from "lucide-react";
import EosCreditCoin from "@/components/wallet/EosCreditCoin";
import type { AdminOfficePlan } from "@/lib/admin/adminOfficePlan";

const PLANS = [
  { id: "start", label: "Start", credits: 15 },
  { id: "pro", label: "Pro", credits: 45 },
  { id: "enterprise", label: "Enterprise", credits: 100 },
] as const;

const PLAN_LABEL: Record<string, string> = { free: "Free", start: "Start", pro: "Pro", enterprise: "Enterprise" };

const fieldCls = "w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm";
const btnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--eos-border)] px-3 py-2 text-[10px] font-black uppercase tracking-wider disabled:opacity-50";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

/** Centrala → biuro: aktywacja / cofnięcie pakietu Partner i korekta puli kredytów biurowych. */
export default function AdminOfficePlanSection({ companyId, onChanged }: { companyId: number; onChanged?: () => void }) {
  const [office, setOffice] = useState<AdminOfficePlan | null>(null);
  const [planId, setPlanId] = useState<string>("pro");
  const [days, setDays] = useState("30");
  const [withCredits, setWithCredits] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/agencies/${companyId}/office`, { cache: "no-store", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (data?.success) setOffice(data.office);
    else setMsg({ ok: false, text: String(data?.error || "Nie udało się wczytać pakietu biura.") });
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, payload: Record<string, unknown>, ok: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/agencies/${companyId}/office`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || "Nie udało się."));
      setOffice(data.office);
      setMsg({ ok: true, text: ok });
      setAmount("");
      setReason("");
      onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Nie udało się." });
    } finally {
      setBusy(null);
    }
  };

  const n = Math.abs(Math.trunc(Number(amount)));
  const plan = PLANS.find((p) => p.id === planId);

  return (
    <section className="mb-5 space-y-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-4">
      <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
        <Building2 size={12} /> Pakiet i kredyty biura
      </h3>

      {!office ? (
        <Loader2 size={16} className="animate-spin text-[var(--eos-muted)]" />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <EosCreditCoin count={office.credits} variant="office" size="md" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">
                {office.active ? `Partner ${PLAN_LABEL[office.planId || ""] || ""} · aktywny` : "Pakiet nieaktywny"}
              </p>
              <p className="text-xs text-[var(--eos-muted)]">
                {office.active
                  ? `do ${fmtDate(office.expiresAt)} (${office.daysRemaining ?? 0} dni)`
                  : office.expiresAt
                    ? `wygasł ${fmtDate(office.expiresAt)} — kredyty biura zamrożone`
                    : "biuro nie miało jeszcze pakietu"}
              </p>
            </div>
            {office.active ? (
              <button
                type="button"
                disabled={busy != null}
                className={`${btnCls} border-red-500/40 text-red-600 dark:text-red-400`}
                onClick={() =>
                  void act(
                    "revoke",
                    { action: "revoke_plan" },
                    "Pakiet cofnięty — kredyty biura i agentów są zamrożone.",
                    "Cofnąć pakiet Partner tego biura? Wygaśnie od razu, a kredyty zostaną zamrożone do czasu przedłużenia.",
                  )
                }
              >
                Cofnij pakiet
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-[1fr_5.5rem] gap-2">
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={fieldCls}>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  Partner {p.label} · {p.credits} kredytów
                </option>
              ))}
            </select>
            <label className="relative">
              <input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} className={`${fieldCls} pr-9`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--eos-muted)]">dni</span>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--eos-muted)]">
            <input type="checkbox" checked={withCredits} onChange={(e) => setWithCredits(e.target.checked)} />
            Dolicz kredyty pakietu do puli biura (+{plan?.credits ?? 0})
          </label>
          <button
            type="button"
            disabled={busy != null}
            className={`${btnCls} w-full border-emerald-500/40 text-emerald-600 dark:text-emerald-400`}
            onClick={() =>
              void act(
                "activate",
                { action: "activate_plan", planId, days: Number(days), withCredits },
                office.active ? "Pakiet przedłużony." : "Pakiet aktywowany — kredyty biura odmrożone.",
              )
            }
          >
            {busy === "activate" ? <Loader2 size={12} className="animate-spin" /> : null}
            {office.active ? "Przedłuż / zmień pakiet" : "Aktywuj pakiet"}
          </button>

          <div className="border-t border-[var(--eos-border)] pt-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Kredyty biurowe (pula kierownika)</p>
            <div className="grid grid-cols-[5rem_1fr] gap-2">
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ile" className={fieldCls} />
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Powód (widzi kierownik w historii)" className={fieldCls} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy != null || !n}
                className={btnCls}
                onClick={() => void act("add", { action: "adjust_credits", delta: n, reason }, `Dodano ${n} kredytów biurowych.`)}
              >
                <Plus size={12} /> Dodaj
              </button>
              <button
                type="button"
                disabled={busy != null || !n}
                className={btnCls}
                onClick={() =>
                  void act("take", { action: "adjust_credits", delta: -n, reason }, "Kredyty biurowe zabrane.", `Zabrać ${n} kredytów biurowych z puli?`)
                }
              >
                <Minus size={12} /> Zabierz
              </button>
            </div>
          </div>
        </>
      )}

      {msg ? <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{msg.text}</p> : null}
    </section>
  );
}

/** Szybkie dodanie / zabranie złotych kredytów konkretnemu kontu (z wpisem w historii portfela). */
export function AdminGoldCreditsQuick({ userId, onChanged }: { userId: number; onChanged?: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const n = Math.abs(Math.trunc(Number(amount)));

  const adjust = async (sign: 1 | -1) => {
    if (sign < 0 && !window.confirm(`Zabrać ${n} złotych kredytów z tego konta?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: sign * n, reason: sign > 0 ? "Przydział z Centrali" : "Korekta z Centrali" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || "Nie udało się."));
      setMsg({ ok: true, text: data.unchanged ? String(data.message) : `Saldo: ${data.next}` });
      setAmount("");
      onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Nie udało się." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Złote kredyty"
        className="w-28 rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-2 py-1 text-xs"
      />
      <button type="button" disabled={busy || !n} onClick={() => void adjust(1)} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-2 py-1 text-[9px] font-bold uppercase text-amber-600 disabled:opacity-50 dark:text-amber-400">
        <Plus size={10} /> Dodaj
      </button>
      <button type="button" disabled={busy || !n} onClick={() => void adjust(-1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 text-[9px] font-bold uppercase text-[var(--eos-muted)] disabled:opacity-50">
        <Minus size={10} /> Zabierz
      </button>
      {msg ? <span className={`text-[10px] font-semibold ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{msg.text}</span> : null}
    </div>
  );
}
