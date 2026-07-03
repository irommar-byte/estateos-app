"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { AdminUserDetail } from "@/lib/adminUserDetail";

const ROLES = ["USER", "AGENT", "ADMIN"] as const;
const PLANS = ["NONE", "PRO", "PLUS", "AGENCY", "INVESTOR"] as const;
const MEMBER_ROLES = ["AGENT", "ADMIN"] as const;
const TITLES = [
  "DORADCA",
  "AGENT",
  "BROKER",
  "EXPERT",
  "LEADER",
  "KIEROWNIK_BIURO",
  "ZASTEPCA_KIEROWNIKA",
] as const;

const TITLE_LABELS: Record<string, string> = {
  DORADCA: "Doradca",
  AGENT: "Agent",
  BROKER: "Broker",
  EXPERT: "Ekspert",
  LEADER: "Lider",
  KIEROWNIK_BIURO: "Kierownik biura (zarząd)",
  ZASTEPCA_KIEROWNIKA: "Zastępca kierownika",
};

export default function AdminUserAccessSection({
  user,
  onUpdated,
}: {
  user: AdminUserDetail;
  onUpdated: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [planType, setPlanType] = useState(user.planType || "NONE");
  const [memberRole, setMemberRole] = useState(user.agencyMembership?.memberRole || "AGENT");
  const [agentTitle, setAgentTitle] = useState(user.agencyMembership?.agentTitle || "AGENT");
  const [isPro, setIsPro] = useState(user.isPro);

  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role,
          planType,
          isPro,
          agencyMemberRole: user.agencyMembership ? memberRole : undefined,
          agentTitle: user.agencyMembership ? agentTitle : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.error || "Nie udało się zapisać uprawnień.");
        return;
      }
      onUpdated();
      alert("Zapisano uprawnienia.");
    } catch {
      alert("Błąd sieci.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-xs text-[var(--eos-muted)]">
        <strong>Zarząd EstateOS</strong> = rola ADMIN. <strong>Zarząd biura</strong> = rola ADMIN w członkostwie lub tytuł Kierownik biura.
      </p>
      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
        Rola konta
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === "ADMIN" ? "ADMIN (Zarząd EstateOS)" : r === "AGENT" ? "AGENT" : "USER (prywatny)"}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
        Plan (planType)
        <select
          value={planType}
          onChange={(e) => setPlanType(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2 text-sm"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPro}
          onChange={(e) => setIsPro(e.target.checked)}
          className="size-4 rounded border-[var(--eos-border)]"
        />
        <span>
          <strong>Partner PRO</strong> (isPro) — niezależnie od planType
        </span>
      </label>
      {user.agencyMembership ? (
        <>
          <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            Rola w biurze ({user.agencyMembership.companyName})
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2 text-sm"
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "ADMIN" ? "ADMIN (zarząd biura)" : "AGENT"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            Tytuł zawodowy
            <select
              value={agentTitle}
              onChange={(e) => setAgentTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2 text-sm"
            >
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {TITLE_LABELS[t] || t}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="text-xs text-[var(--eos-muted)]">Brak członkostwa w biurze — przypisz przez segment Agencje.</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        Zapisz role i zarząd
      </button>
    </div>
  );
}
