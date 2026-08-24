"use client";

import { useState } from "react";

type Slot = {
  startsAt: string;
  status: "confirmed" | "pending";
};

export default function ClientPortalScheduleActions({
  token,
  kind,
  slot,
  onDone,
}: {
  token: string;
  kind: "meeting" | "presentation";
  slot: Slot;
  onDone: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<"confirm" | "change" | null>(null);
  const [openChange, setOpenChange] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const confirmAction = kind === "meeting" ? "confirm_meeting" : "confirm_presentation";
  const changeAction = kind === "meeting" ? "propose_meeting_change" : "propose_presentation_change";

  const post = async (action: string, extra?: Record<string, string>) => {
    setError("");
    const res = await fetch(`/api/crm/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(json.error || "Nie udało się zapisać."));
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {slot.status !== "confirmed" ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setBusy("confirm");
              void post(confirmAction)
                .then(() => onDone())
                .catch((e) => setError(e instanceof Error ? e.message : "Błąd"))
                .finally(() => setBusy(null));
            }}
            className="eos-engraved-cta eos-engraved-cta--home"
          >
            {busy === "confirm" ? "Zapisuję…" : "Potwierdź termin"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => setOpenChange((v) => !v)}
          className="eos-engraved-cta"
        >
          {openChange ? "Anuluj zmianę" : "Zaproponuj inny termin"}
        </button>
      </div>

      {openChange ? (
        <div className="eos-inset-well space-y-3 rounded-2xl p-4">
          <label className="block text-sm font-semibold text-[var(--eos-text)]">
            Nowy termin
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="eos-field-inset mt-2 w-full rounded-xl px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--eos-text)]">
            Dlaczego zmieniasz
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="eos-field-inset mt-2 w-full rounded-xl px-3 py-2 text-sm"
              placeholder="Np. kolizja z pracą, proszę o popołudnie…"
            />
          </label>
          <button
            type="button"
            disabled={Boolean(busy) || !startsAt || reason.trim().length < 3}
            onClick={() => {
              setBusy("change");
              void post(changeAction, { startsAt: new Date(startsAt).toISOString(), reason: reason.trim() })
                .then(() => {
                  setOpenChange(false);
                  setReason("");
                  return onDone();
                })
                .catch((e) => setError(e instanceof Error ? e.message : "Błąd"))
                .finally(() => setBusy(null));
            }}
            className="eos-engraved-cta eos-engraved-cta--home"
          >
            {busy === "change" ? "Wysyłam…" : "Wyślij propozycję agentowi"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-500">{error}</p> : null}
    </div>
  );
}
