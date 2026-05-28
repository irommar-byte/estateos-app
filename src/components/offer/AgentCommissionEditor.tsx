"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_COMMISSION_DEFAULT_PERCENT,
  AGENT_COMMISSION_MIN_NONZERO,
  AGENT_COMMISSION_STEP,
  AGENT_COMMISSION_ZERO_PERCENT,
  commissionAmountInputToPercent,
  computeAgentCommissionAmount,
  formatPercentLabel,
  formatPlnAmount,
  maxAgentCommissionAmountPln,
  parseAgentCommissionPercent,
  previewAmountFromPercentDraft,
  previewPercentFromAmountDraft,
  roundToQuarter,
  shouldWarnCommissionPercentDraft,
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
  const [percentDraft, setPercentDraft] = useState(percentValue);
  const [amountDraft, setAmountDraft] = useState("");
  const [percentFocused, setPercentFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const skipPropSyncRef = useRef(false);

  useEffect(() => {
    if (percentFocused || amountFocused) return;
    setPercentDraft(percentValue);
    const p = parseAgentCommissionPercent(percentValue);
    if (p !== null && p > 0) {
      setAmountDraft(String(computeAgentCommissionAmount(priceRaw, p)));
    } else if (!percentValue.trim()) {
      setAmountDraft("");
    }
  }, [percentValue, priceRaw, percentFocused, amountFocused]);

  const amountPreview = previewAmountFromPercentDraft(priceRaw, percentDraft);
  const percentPreview = previewPercentFromAmountDraft(priceRaw, amountDraft);
  const showWarning = shouldWarnCommissionPercentDraft(percentDraft, {
    isFocused: percentFocused || amountFocused,
  });

  const maxCommissionPln = useMemo(() => maxAgentCommissionAmountPln(priceRaw), [priceRaw]);

  const commitPercentDraft = () => {
    const trimmed = percentDraft.trim();
    if (!trimmed) {
      setPercentDraft("");
      onPercentChange("");
      return;
    }
    const parsed = parseAgentCommissionPercent(trimmed);
    if (parsed === null) return;
    if (parsed === 0) {
      setPercentDraft("0");
      setAmountDraft("0");
      onPercentChange("0");
      return;
    }
    const snapped = roundToQuarter(Math.max(AGENT_COMMISSION_MIN_NONZERO, parsed));
    const next = String(snapped).replace(".", ",");
    setPercentDraft(next);
    setAmountDraft(String(computeAgentCommissionAmount(priceRaw, snapped)));
    skipPropSyncRef.current = true;
    onPercentChange(next);
  };

  const commitAmountDraft = () => {
    const trimmed = amountDraft.trim();
    if (!trimmed) {
      setAmountDraft("");
      setPercentDraft("");
      skipPropSyncRef.current = true;
      onPercentChange("");
      return;
    }
    const synced = commissionAmountInputToPercent(priceRaw, trimmed);
    if (!synced) return;
    setAmountDraft(String(synced.amountPln));
    const next = String(synced.percent).replace(".", ",");
    setPercentDraft(next);
    skipPropSyncRef.current = true;
    onPercentChange(next);
  };

  const switchMode = (next: AgentCommissionInputMode) => {
    if (next === mode) return;
    if (mode === "amount") commitAmountDraft();
    else commitPercentDraft();
    setMode(next);
    if (next === "amount" && amountPreview > 0) {
      setAmountDraft(String(amountPreview));
    }
  };

  const adjustPercent = (delta: number) => {
    const base = parseAgentCommissionPercent(percentDraft) ?? AGENT_COMMISSION_DEFAULT_PERCENT;
    if (delta > 0 && base === 0) {
      const v = String(AGENT_COMMISSION_MIN_NONZERO).replace(".", ",");
      setPercentDraft(v);
      setAmountDraft(String(computeAgentCommissionAmount(priceRaw, AGENT_COMMISSION_MIN_NONZERO)));
      skipPropSyncRef.current = true;
      onPercentChange(v);
      return;
    }
    if (delta < 0 && base <= AGENT_COMMISSION_MIN_NONZERO) {
      setPercentDraft("0");
      setAmountDraft("0");
      skipPropSyncRef.current = true;
      onPercentChange("0");
      return;
    }
    const next = Math.max(AGENT_COMMISSION_ZERO_PERCENT, Math.round((base + delta) * 4) / 4);
    const v = String(next).replace(".", ",");
    setPercentDraft(v);
    setAmountDraft(String(computeAgentCommissionAmount(priceRaw, next)));
    skipPropSyncRef.current = true;
    onPercentChange(v);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Prowizja agenta</span>
        <div className="flex rounded-full border border-white/10 overflow-hidden ml-auto">
          {(["percent", "amount"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
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
        {AGENT_COMMISSION_MIN_NONZERO}% wzwyż).
        Prowizja jest <strong className="text-zinc-300">brutto</strong>, płatna bezpośrednio agentowi.
      </p>
      {Number.isFinite(maxCommissionPln) && maxCommissionPln > 0 ? (
        <p className="text-[10px] text-zinc-500">
          Przy tej cenie maks. kwota prowizji:{" "}
          <span className="text-orange-400/90">{formatPlnAmount(maxCommissionPln)}</span>
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
                className={`flex-1 w-full bg-[#080808] border rounded-2xl text-white text-lg py-3 px-4 outline-none focus:border-orange-500/50 ${
                  showWarning ? "border-red-500/50" : "border-white/10"
                }`}
                value={percentDraft}
                onChange={(e) => setPercentDraft(e.target.value.replace(/[^0-9.,]/g, ""))}
                onFocus={() => setPercentFocused(true)}
                onBlur={() => {
                  setPercentFocused(false);
                  commitPercentDraft();
                }}
                inputMode="decimal"
                placeholder={String(AGENT_COMMISSION_DEFAULT_PERCENT).replace(".", ",")}
              />
              <span className="text-white font-bold">%</span>
            </div>
          ) : (
            <input
              className="w-full bg-[#080808] border border-white/10 rounded-2xl text-white text-lg py-3 px-4 outline-none focus:border-orange-500/50"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value.replace(/[^\d]/g, ""))}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => {
                setAmountFocused(false);
                commitAmountDraft();
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
            {mode === "percent" ? "Z ceny ofertowej (podgląd)" : "Odpowiada (podgląd)"}
          </p>
          <p className="text-2xl font-black text-orange-400">
            {mode === "percent"
              ? amountPreview > 0
                ? formatPlnAmount(amountPreview)
                : "—"
              : percentPreview !== null
                ? formatPercentLabel(Math.max(0, percentPreview))
                : "—"}
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            {mode === "amount"
              ? "Procent aktualizuje się na żywo; po zakończeniu edycji zaokrąglimy do 0,25%."
              : "Kwota liczona z ceny ofertowej brutto."}
          </p>
        </div>
      </div>

      {showWarning ? (
        <p className="text-xs text-red-400">
          Dozwolone: 0% (bez prowizji) lub od {AGENT_COMMISSION_MIN_NONZERO}% co {AGENT_COMMISSION_STEP}%.
        </p>
      ) : null}
    </div>
  );
}
