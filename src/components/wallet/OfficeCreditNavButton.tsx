"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import EosCreditCoin from "@/components/wallet/EosCreditCoin";
import { VaultHero, VaultLink, VaultModal, VaultNotice, VaultSection, VaultSwitch } from "@/components/wallet/Vault";
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

function creditsWord(n: number) {
  if (n === 1) return "kredyt";
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? "kredyty" : "kredytów";
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
  const bestPack = office.packs.reduce<(typeof office.packs)[number] | null>((best, p) => (!best || p.unitPln < best.unitPln ? p : best), null);

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

  const toggleVisibility = async (visible: boolean) => {
    setBusy("visibility");
    setError("");
    try {
      await call({ action: "set_visibility", visible });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    } finally {
      setBusy(null);
    }
  };

  const status = office.frozen
    ? { tone: "bad" as const, text: "Zamrożone" }
    : office.low
      ? { tone: "warn" as const, text: "Kończą się" }
      : { tone: "ok" as const, text: "Aktywne" };

  return (
    <VaultModal open={open} onClose={onClose} variant="office" label="Kredyty biurowe">
      <VaultHero
        variant="office"
        kicker={`Kredyty biurowe · ${office.companyName}`}
        balance={office.balance}
        unit={`${creditsWord(office.balance)} w puli biura`}
        status={status}
        alert={office.low}
        onClose={onClose}
      >
        {office.frozen
          ? "Pakiet Partner wygasł — kredyty czekają zamrożone i wrócą do użytku po jego przedłużeniu."
          : `Ważne do ${fmtDate(office.poolExpiresAt)}. Publikacja ogłoszenia agenta — 1 kredyt, Smart Agent OS™ — 10 kredytów.`}
      </VaultHero>

      <div className="vault-body">
        {office.frozen ? (
          <VaultLink href="/cennik?tab=partner" icon={<Sparkles size={17} />} title="Przedłuż pakiet Partner" sub="Odmraża kredyty biura i agentów" />
        ) : null}

        {manager && office.pendingApprovals > 0 ? (
          <VaultLink
            href="/moje-konto/crm?tab=pulpit#do-zatwierdzenia"
            icon={<ClipboardCheck size={17} />}
            title={`Prośby agentów do zatwierdzenia: ${office.pendingApprovals}`}
            sub="Publikacje i Smart Agent OS™ czekają na Twoją decyzję"
            warn
          />
        ) : null}

        {!manager ? (
          <VaultNotice tone="info">
            {office.monthlyLimit > 0
              ? `W tym miesiącu możesz jeszcze wykorzystać ${office.trustedRemaining} z ${office.monthlyLimit} kredytów biura bez czekania na zgodę kierownika.`
              : "Publikacja z kredytu biura trafia do zatwierdzenia przez kierownika."}
          </VaultNotice>
        ) : null}

        {manager ? (
          <VaultSection title="Dokup kredyty biurowe">
            {office.canBuy ? (
              <div className="vault-packs">
                {office.packs.map((p) => (
                  <button key={p.id} type="button" className="vault-pack" disabled={busy != null} onClick={() => void buy(p.id)}>
                    {bestPack?.id === p.id ? <span className="vault-pack__badge">Najtaniej</span> : null}
                    <span className="vault-pack__credits">{p.credits}</span>
                    <span className="vault-pack__unit">{creditsWord(p.credits)} · {p.unitPln} zł/szt.</span>
                    <span className="vault-pack__price">
                      {busy === p.id ? <Loader2 size={14} className="animate-spin" /> : null}
                      {p.totalPln} zł
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <VaultNotice tone="warn">{office.buyBlockedReason}</VaultNotice>
            )}
            <p className="vault-note mt-2.5">Faktura VAT na biuro — nazwa i NIP z danych firmy.</p>
          </VaultSection>
        ) : null}

        {manager ? (
          <VaultSwitch
            title="Agenci widzą monetę biura"
            sub="Granatowa moneta z saldem puli pojawi się także w nagłówku agentów."
            checked={office.visibleToAgents}
            disabled={busy === "visibility"}
            onChange={(next) => void toggleVisibility(next)}
          />
        ) : null}

        {error ? <VaultNotice tone="bad">{error}</VaultNotice> : null}

        {manager ? (
          <VaultSection title="Historia puli">
            {office.history.length ? (
              <div className="vault-list">
                {office.history.map((h) => (
                  <div key={h.id} className="vault-row">
                    <span className={`vault-row__icon ${h.delta > 0 ? "vault-row__icon--in" : ""}`}>
                      {h.delta > 0 ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                    </span>
                    <span className="vault-row__text">
                      <span className="vault-row__title">
                        {h.label}
                        {h.who ? ` · ${h.who}` : ""}
                      </span>
                      <span className="vault-row__meta">
                        {new Date(h.at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {h.note ? ` · ${h.note}` : ""}
                      </span>
                    </span>
                    <span className={`vault-row__delta ${h.delta > 0 ? "vault-row__delta--in" : ""}`}>{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="vault-empty">Pula nie ma jeszcze ruchów.</p>
            )}
          </VaultSection>
        ) : null}
      </div>
    </VaultModal>
  );
}
