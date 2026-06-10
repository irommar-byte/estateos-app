"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AGENT_COMMISSION_DEFAULT_PERCENT,
  AGENT_COMMISSION_MIN_NONZERO,
  AGENT_COMMISSION_STEP,
  AGENT_COMMISSION_ZERO_PERCENT,
  commissionAmountInputToPercent,
  computeAgentCommissionAmount,
  formatPercentLabel,
  parseAgentCommissionPercent,
  previewPercentFromAmountDraft,
  roundToQuarter,
  shouldWarnCommissionPercentDraft,
} from "@/lib/agentCommission";
import type { AddOfferDictionary } from "@/i18n/addOfferDictionary";

type Props = {
  priceRaw: string | number;
  percentValue: string;
  onPercentChange: (value: string) => void;
  ao: Pick<
    AddOfferDictionary,
    | "commissionEditorNote"
    | "commissionPercentField"
    | "commissionAmountField"
    | "commissionStepPct"
    | "commissionAmountFromPrice"
    | "commissionAmountComputed"
    | "commissionInvalidWarning"
  >;
  className?: string;
};

export default function AgentCommissionEditor({
  priceRaw,
  percentValue,
  onPercentChange,
  ao,
  className = "",
}: Props) {
  const [percentDraft, setPercentDraft] = useState(percentValue);
  const [amountDraft, setAmountDraft] = useState("");
  const [percentFocused, setPercentFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);

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

  const percentPreview = previewPercentFromAmountDraft(priceRaw, amountDraft);
  const showWarning = shouldWarnCommissionPercentDraft(percentDraft, {
    isFocused: percentFocused || amountFocused,
  });

  const commitPercentDraft = () => {
    const trimmed = percentDraft.trim();
    if (!trimmed) {
      setPercentDraft("");
      setAmountDraft("");
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
    const next = String(Math.max(AGENT_COMMISSION_MIN_NONZERO, parsed)).replace(".", ",");
    setPercentDraft(next);
    setAmountDraft(String(computeAgentCommissionAmount(priceRaw, parsed)));
    onPercentChange(next);
  };

  const commitAmountDraft = () => {
    const trimmed = amountDraft.trim();
    if (!trimmed) {
      setAmountDraft("");
      setPercentDraft("");
      onPercentChange("");
      return;
    }
    const synced = commissionAmountInputToPercent(priceRaw, trimmed);
    if (!synced) return;
    setAmountDraft(String(synced.amountPln));
    const next = String(synced.percent).replace(".", ",");
    setPercentDraft(next);
    onPercentChange(next);
  };

  const adjustPercent = (delta: number) => {
    const base = parseAgentCommissionPercent(percentDraft) ?? AGENT_COMMISSION_DEFAULT_PERCENT;
    if (delta > 0 && base === 0) {
      const v = String(AGENT_COMMISSION_MIN_NONZERO).replace(".", ",");
      setPercentDraft(v);
      setAmountDraft(String(computeAgentCommissionAmount(priceRaw, AGENT_COMMISSION_MIN_NONZERO)));
      onPercentChange(v);
      return;
    }
    if (delta < 0 && base <= AGENT_COMMISSION_MIN_NONZERO) {
      setPercentDraft("0");
      setAmountDraft("0");
      onPercentChange("0");
      return;
    }
    const next = Math.max(AGENT_COMMISSION_ZERO_PERCENT, roundToQuarter(base + delta));
    const v = String(next).replace(".", ",");
    setPercentDraft(v);
    setAmountDraft(String(computeAgentCommissionAmount(priceRaw, next)));
    onPercentChange(v);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-xs text-zinc-400 leading-relaxed">{ao.commissionEditorNote}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
            {ao.commissionPercentField}
          </label>
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
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {ao.commissionStepPct.replace("{step}", String(AGENT_COMMISSION_STEP))}
            </span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
            {ao.commissionAmountField}
          </label>
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
          <p className="text-xs text-zinc-500 mt-2">
            {percentPreview !== null && percentPreview > 0
              ? ao.commissionAmountComputed.replace("{pct}", formatPercentLabel(percentPreview))
              : ao.commissionAmountFromPrice}
          </p>
        </div>
      </div>

      {showWarning ? (
        <p className="text-xs text-red-400">
          {ao.commissionInvalidWarning.replace("{min}", String(AGENT_COMMISSION_MIN_NONZERO))}
        </p>
      ) : null}
    </div>
  );
}
