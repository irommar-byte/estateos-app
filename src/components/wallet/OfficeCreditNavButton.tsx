"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Building2, Eye, Loader2 } from "lucide-react";
import EosCreditCoin from "@/components/wallet/EosCreditCoin";
import EosModal from "@/components/ui/EosModal";
import type { OfficeCreditsSummary } from "@/lib/crm/officeCredits";

/** Granatowa moneta puli biura — obok złotej monety kredytów osobistych. */
export default function OfficeCreditNavButton() {
  const [office, setOffice] = useState<OfficeCreditsSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agency-company/office-credits", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setOffice(data?.office ?? null);
    } catch {
      /* moneta po prostu się nie pokaże */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      // Powrót z płatności za kredyty biurowe: dopisujemy od razu i czyścimy adres.
      const params = new URLSearchParams(window.location.search);
      if (params.get("office_credits") === "success" && params.get("session_id")) {
        await fetch("/api/agency-company/office-credits", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", sessionId: params.get("session_id") }),
        }).catch(() => undefined);
        params.delete("office_credits");
        params.delete("session_id");
        window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
        setOpen(true);
      }
      await load();
    })();
    const interval = window.setInterval(() => void load(), 120_000);
    const onRefresh = () => void load();
    const onOpen = () => setOpen(true);
    window.addEventListener("officeCreditsRefresh", onRefresh);
    window.addEventListener("openOfficeCredits", onOpen);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("officeCreditsRefresh", onRefresh);
      window.removeEventListener("openOfficeCredits", onOpen);
    };
  }, [load]);

  if (!office) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={`Kredyty biurowe: ${office.balance}${office.frozen ? " (zamrożone)" : ""}`}
        title={office.frozen ? "Kredyty biurowe zamrożone — przedłuż pakiet Partner" : `Kredyty biurowe: ${office.balance}`}
        className={`group relative rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1.5 transition-colors hover:border-[#2c4ea6]/35 ${office.frozen ? "opacity-60" : ""}`}
      >
        <EosCreditCoin count={office.balance} spinning={hover} variant="office" alert={office.low} />
        {office.role === "manager" && office.pendingApprovals > 0 ? (
          <span className="eos-nav-unread" aria-label={`Do zatwierdzenia: ${office.pendingApprovals}`}>
            {office.pendingApprovals > 9 ? "9+" : office.pendingApprovals}
          </span>
        ) : null}
      </button>
      <OfficeCreditsModal open={open} office={office} onClose={() => setOpen(false)} onChanged={() => void load()} />
    </>
  );
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

function OfficeCreditsModal({
  open,
  office,
  onClose,
  onChanged,
}: {
  open: boolean;
  office: OfficeCreditsSummary;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const manager = office.role === "manager";

  const call = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/agency-company/office-credits", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(String(data?.error || "Nie udało się."));
    return data;
  };

  const buy = async (pack: string) => {
    setBusy(pack);
    setError("");
    try {
      const data = await call({ action: "checkout", pack, returnPath: `${window.location.pathname}${window.location.search}` });
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się rozpocząć płatności.");
      setBusy(null);
    }
  };

  const toggleVisibility = async () => {
    setBusy("visibility");
    setError("");
    try {
      await call({ action: "set_visibility", visible: !office.visibleToAgents });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    } finally {
      setBusy(null);
    }
  };

  const status = office.frozen
    ? { cls: "eos-sig--bad", text: "Zamrożone — przedłuż pakiet Partner, kredyty wrócą do użytku" }
    : office.low
      ? { cls: "eos-sig--warn", text: `Kończą się — zostało ${office.balance}` }
      : { cls: "eos-sig--ok", text: `Aktywne do ${fmtDate(office.poolExpiresAt)}` };

  return (
    <EosModal
      open={open}
      onClose={onClose}
      title="Kredyty biurowe"
      subtitle={office.companyName}
      icon={<Building2 className="size-5" />}
      iconWrapClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#2c4ea6]/30 bg-[#2c4ea6]/10 text-[#2c4ea6]"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <EosCreditCoin count={office.balance} size="md" variant="office" alert={office.low} />
          <div className="min-w-0">
            <p className="text-[28px] font-semibold leading-none tracking-tight text-[var(--eos-text)]">{office.balance}</p>
            <p className="mt-1 text-[12.5px] text-[var(--eos-muted)]">kredytów w puli biura</p>
          </div>
          <span className={`eos-sig ${status.cls} ml-auto`}>{status.text}</span>
        </div>

        <p className="text-[13px] leading-relaxed text-[var(--eos-muted)]">
          Kredyty biurowe idą wyłącznie na ogłoszenia i usługi biura: publikację ogłoszeń agentów (1 kredyt) i Smart Agent OS™ (10 kredytów).
          Działają przy aktywnym pakiecie Partner.
        </p>

        {office.frozen ? (
          <a href="/cennik?tab=partner" className="flex items-center justify-between rounded-2xl border border-[var(--eos-border)] px-4 py-3 text-[13.5px] font-semibold text-[var(--eos-text)] hover:border-[#2c4ea6]/40">
            Przedłuż pakiet Partner <ArrowUpRight className="size-4" />
          </a>
        ) : null}

        {manager && office.pendingApprovals > 0 ? (
          <a href="/moje-konto/crm?tab=pulpit#do-zatwierdzenia" className="eos-sig-box eos-sig--warn flex items-center justify-between px-4 py-3 text-[13.5px] font-semibold">
            Prośby agentów do zatwierdzenia: {office.pendingApprovals} <ArrowUpRight className="size-4" />
          </a>
        ) : null}

        {!manager ? (
          <p className="rounded-2xl bg-[var(--eos-input)] px-4 py-3 text-[13px] text-[var(--eos-text)]">
            {office.monthlyLimit > 0
              ? `W tym miesiącu możesz jeszcze wykorzystać ${office.trustedRemaining} z ${office.monthlyLimit} kredytów biura bez czekania na zgodę kierownika.`
              : "Publikacja z kredytu biura trafia do zatwierdzenia przez kierownika."}
          </p>
        ) : null}

        {manager ? (
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--eos-muted)]">Dokup kredyty biurowe</p>
            {office.canBuy ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {office.packs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy != null}
                    onClick={() => void buy(p.id)}
                    className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_6px_16px_-10px_rgba(20,43,107,0.35)] transition hover:-translate-y-px hover:border-[#2c4ea6]/45 disabled:opacity-60"
                  >
                    <span className="block text-[20px] font-semibold text-[var(--eos-text)]">{p.credits}</span>
                    <span className="block text-[12px] text-[var(--eos-muted)]">kredytów · {p.unitPln} zł/szt.</span>
                    <span className="mt-2 flex items-center gap-1 text-[13px] font-bold text-[#22408f] dark:text-[#a9bdf0]">
                      {busy === p.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      {p.totalPln} zł
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="eos-sig-box eos-sig--warn px-4 py-3 text-[13px]">{office.buyBlockedReason}</p>
            )}
            <p className="mt-2 text-[11.5px] text-[var(--eos-muted)]">Faktura na biuro — nazwa i NIP z danych firmy.</p>
          </section>
        ) : null}

        {manager ? (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--eos-border)] px-4 py-3">
            <span className="flex items-center gap-2 text-[13.5px] text-[var(--eos-text)]">
              <Eye className="size-4 text-[var(--eos-muted)]" /> Agenci widzą monetę biura
            </span>
            <input
              type="checkbox"
              className="size-4 accent-[#2c4ea6]"
              checked={office.visibleToAgents}
              disabled={busy === "visibility"}
              onChange={() => void toggleVisibility()}
            />
          </label>
        ) : null}

        {error ? <p className="eos-sig-box eos-sig--bad px-4 py-3 text-[13px]">{error}</p> : null}

        {manager && office.history.length ? (
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--eos-muted)]">Historia puli</p>
            <ul className="divide-y divide-[var(--eos-border)] rounded-2xl border border-[var(--eos-border)]">
              {office.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[var(--eos-text)]">
                      {h.label}
                      {h.who ? ` · ${h.who}` : ""}
                    </span>
                    <span className="block truncate text-[11.5px] text-[var(--eos-muted)]">
                      {new Date(h.at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[14px] font-bold tabular-nums ${h.delta > 0 ? "text-[#1f7a55]" : "text-[var(--eos-text)]"}`}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </EosModal>
  );
}
