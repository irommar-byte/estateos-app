"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AGENT_COMMISSION_DEFAULT_PERCENT,
  AGENT_COMMISSION_MAX,
  AGENT_COMMISSION_MIN_NONZERO,
  AGENT_COMMISSION_STEP,
  AGENT_COMMISSION_ZERO_PERCENT,
  commissionAmountInputToPercent,
  computeAgentCommissionAmount,
  formatPercentLabel,
  formatPlnAmount,
  maxAgentCommissionAmountPln,
  isZeroCommissionPercent,
  parseAgentCommissionPercent,
  type AgentCommissionInputMode,
} from "@/lib/agentCommission";

type Props = {
  priceRaw: string | number;
  percentValue: string;
  onPercentChange: (value: string) => void;
  className?: string;
};

export default function AgentCommissionEditor({
  priceRaw,
  percentValue,
  onPercentChange,
  className = "",
}: Props) {
  const [mode, setMode] = useState<AgentCommissionInputMode>("percent");
  const [amountDraft, setAmountDraft] = useState("");

  const percentParsed = parseAgentCommissionPercent(percentValue);
  const commissionAmount = useMemo(() => {
    if (isZeroCommissionPercent(percentParsed)) return 0;
    return computeAgentCommissionAmount(priceRaw, percentParsed);
  }, [percentParsed, priceRaw]);

  useEffect(() => {
    if (mode !== "amount") return;
    if (commissionAmount > 0 && !amountDraft) {
      setAmountDraft(String(commissionAmount));
    }
  }, [mode, commissionAmount, amountDraft]);

  const inRange =
    percentParsed !== null &&
    (percentParsed === AGENT_COMMISSION_ZERO_PERCENT ||
      (percentParsed >= AGENT_COMMISSION_MIN_NONZERO && percentParsed <= AGENT_COMMISSION_MAX));

  const maxCommissionPln = useMemo(() => maxAgentCommissionAmountPln(priceRaw), [priceRaw]);

  const syncPercentFromAmount = (amountText: string) => {
    const synced = commissionAmountInputToPercent(priceRaw, amountText);
    if (!synced) return;
    if (String(synced.amountPln) !== amountText.replace(/\D/g, "")) {
      setAmountDraft(String(synced.amountPln));
    }
    onPercentChange(String(synced.percent).replace(".", ","));
  };

  const adjustPercent = (delta: number) => {
    const base = percentParsed ?? AGENT_COMMISSION_DEFAULT_PERCENT;
    if (delta > 0 && base === 0) {
      onPercentChange(String(AGENT_COMMISSION_MIN_NONZERO).replace(".", ","));
      return;
    }
    if (delta < 0 && base <= AGENT_COMMISSION_MIN_NONZERO) {
      onPercentChange("0");
      return;
    }
    const next = Math.min(
      AGENT_COMMISSION_MAX,
      Math.max(AGENT_COMMISSION_ZERO_PERCENT, Math.round((base + delta) * 4) / 4),
    );
    onPercentChange(String(next).replace(".", ","));
    if (mode === "amount") {
      setAmountDraft(String(computeAgentCommissionAmount(priceRaw, next)));
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Prowizja agenta</span>
        <span className="text-[9px] font-black uppercase tracking-wider text-orange-400/90 border border-orange-500/30 rounded-full px-2 py-0.5">
          max. {AGENT_COMMISSION_MAX}%
        </span>
        <div className="flex rounded-full border border-white/10 overflow-hidden ml-auto">
          {(["percent", "amount"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                if (m === "amount" && commissionAmount > 0) {
                  setAmountDraft(String(commissionAmount));
                }
              }}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                mode === m ? "bg-orange-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {m === "percent" ? "%" : "PLN"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed">
        <strong className="text-zinc-200">Cena ofertowa to ostateczna kwota brutto</strong> — nie podwyższamy jej o
        prowizję. Po transakcji kupujący z tej kwoty wypłaca agentowi uzgodnioną prowizję (od{" "}
        {AGENT_COMMISSION_MIN_NONZERO}% do <strong className="text-zinc-200">maks. {AGENT_COMMISSION_MAX}%</strong> ceny
        lub 0% bez prowizji). Prowizja jest <strong className="text-zinc-300">brutto</strong> (z VAT), płatna
        bezpośrednio agentowi.
      </p>
      {maxCommissionPln > 0 ? (
        <p className="text-[10px] text-zinc-500">
          Przy tej cenie maks. kwota prowizji: <span className="text-orange-400/90">{formatPlnAmount(maxCommissionPln)}</span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
            {mode === "percent" ? "Procent" : "Kwota (PLN)"}
          </label>
          {mode === "percent" ? (
            <div className="flex items-center gap-2">
              <input
                className={`flex-1 ${inRange ? "" : "border-red-500/50"} w-full bg-[#080808] border border-white/10 rounded-2xl text-white text-lg py-3 px-4 outline-none focus:border-orange-500/50`}
                value={percentValue}
                onChange={(e) => onPercentChange(e.target.value.replace(/[^0-9.,]/g, ""))}
                inputMode="decimal"
                placeholder={String(AGENT_COMMISSION_DEFAULT_PERCENT).replace(".", ",")}
              />
              <span className="text-white font-bold">%</span>
            </div>
          ) : (
            <input
              className="w-full bg-[#080808] border border-white/10 rounded-2xl text-white text-lg py-3 px-4 outline-none focus:border-orange-500/50"
              value={amountDraft}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^\d]/g, "");
                setAmountDraft(cleaned);
                syncPercentFromAmount(cleaned);
              }}
              inputMode="numeric"
              placeholder="np. 37000"
            />
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => adjustPercent(-AGENT_COMMISSION_STEP)}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white font-bold"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => adjustPercent(AGENT_COMMISSION_STEP)}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white font-bold"
            >
              +
            </button>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Krok {AGENT_COMMISSION_STEP}%</span>
          </div>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
            {mode === "percent" ? "Z ceny ofertowej" : "Odpowiada"}
          </p>
          <p className="text-2xl font-black text-orange-400">
            {mode === "percent"
              ? commissionAmount > 0
                ? formatPlnAmount(commissionAmount)
                : "—"
              : percentParsed !== null
                ? formatPercentLabel(percentParsed)
                : "—"}
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            Wypłata z ceny ofertowej brutto po transakcji (max. {AGENT_COMMISSION_MAX}%)
          </p>
        </div>
      </div>

      {!inRange && percentValue.trim() !== "" ? (
        <p className="text-xs text-red-400">
          Dozwolone: 0% (bez prowizji) lub {AGENT_COMMISSION_MIN_NONZERO}–{AGENT_COMMISSION_MAX}% co {AGENT_COMMISSION_STEP}%.
        </p>
      ) : null}
    </div>
  );
}
