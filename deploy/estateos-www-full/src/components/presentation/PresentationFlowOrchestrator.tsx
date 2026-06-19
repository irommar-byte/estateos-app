"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { getPresentationFlowDictionary } from "@/i18n/presentationFlowDictionary";
import type { PendingPresentationPayload } from "@/lib/appointments/presentationFlowPending";
import PresentationOutcomeModal from "./PresentationOutcomeModal";
import PresentationReviewModal from "./PresentationReviewModal";

/**
 * Globalny orchestrator: domknięcie wizyty → ocena kontrahenta.
 * Montowany w Navbar (cała strona WWW).
 */
export default function PresentationFlowOrchestrator() {
  const { locale } = useLocale();
  const t = getPresentationFlowDictionary(locale);

  const [pending, setPending] = useState<PendingPresentationPayload | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/presentation-flow/pending", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (data?.step && data?.appointment) {
        setPending({ step: data.step, appointment: data.appointment });
      } else {
        setPending(null);
      }
    } catch {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 2500);
    const interval = setInterval(refresh, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refresh]);

  const handleClose = () => {
    if (pending?.appointment?.id) setDismissedId(pending.appointment.id);
    setPending(null);
  };

  const handleSuccess = () => {
    setDismissedId(null);
    void refresh();
  };

  if (!pending || pending.appointment.id === dismissedId) return null;

  if (pending.step === "outcome") {
    return (
      <PresentationOutcomeModal
        open
        data={pending.appointment}
        t={t}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );
  }

  return (
    <PresentationReviewModal
      open
      data={pending.appointment}
      t={t}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  );
}
