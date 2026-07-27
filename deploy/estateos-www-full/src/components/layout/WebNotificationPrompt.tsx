"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  canUseWebNotifications,
  dismissWebNotificationPrompt,
  getWebNotificationPermission,
  isWebNotificationPromptDismissed,
  requestWebNotificationPermission,
} from "@/lib/webNotifications";

export default function WebNotificationPrompt() {
  const { dict } = useLocale();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canUseWebNotifications()) return;
    const permission = getWebNotificationPermission();
    if (permission === "granted" || permission === "denied") return;
    if (isWebNotificationPromptDismissed()) return;
    const timer = window.setTimeout(() => setVisible(true), 2400);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    setBusy(true);
    await requestWebNotificationPermission();
    setBusy(false);
    setVisible(false);
  };

  const handleDismiss = () => {
    dismissWebNotificationPrompt();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={dict.webNotifications.promptTitle}
      className="fixed bottom-6 left-1/2 z-[9998] w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-4 shadow-[var(--eos-shadow-strong)] sm:left-auto sm:right-6 sm:translate-x-0"
    >
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--eos-accent-soft)] text-[var(--eos-accent)]">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--eos-text)]">{dict.webNotifications.promptTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
            {dict.webNotifications.promptBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleEnable()}
              className="eos-btn eos-btn--primary eos-btn--sm disabled:opacity-60"
            >
              {dict.webNotifications.enable}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="eos-btn eos-btn--secondary eos-btn--sm"
            >
              {dict.webNotifications.later}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
          aria-label={dict.notifications.close}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
