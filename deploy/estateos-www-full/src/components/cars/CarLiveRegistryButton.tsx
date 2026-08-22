"use client";

import { FileSearch, ShieldCheck } from "lucide-react";

type Kind = "history" | "insurance";

export default function CarLiveRegistryButton({
  kind,
  label,
  active,
  loading = false,
  onClick,
}: {
  kind: Kind;
  label: string;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  const live = active && !loading;
  const Icon = kind === "history" ? FileSearch : ShieldCheck;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active || loading}
      aria-busy={loading}
      className={`eos-live-reg ${kind === "history" ? "eos-live-reg--history" : "eos-live-reg--insurance"} ${
        live ? "eos-live-reg--live" : ""
      } ${loading ? "eos-live-reg--busy" : ""} ${!active ? "eos-live-reg--off" : ""}`}
    >
      <span className="eos-live-reg__well" aria-hidden />
      <span className="eos-live-reg__grid" aria-hidden />
      {kind === "history" ? <span className="eos-live-reg__scan" aria-hidden /> : <span className="eos-live-reg__oc-ring" aria-hidden />}
      <span className="eos-live-reg__link" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="eos-live-reg__icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="eos-live-reg__copy">{label}</span>
      <span className="eos-live-reg__status">
        {loading ? "Łączenie…" : live ? "Baza online" : "Oczekuje danych"}
      </span>
    </button>
  );
}
