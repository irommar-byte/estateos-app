"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Bookmark, CheckCircle2, Download, Share2, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NotifyState = "idle" | "busy" | "enabled" | "blocked" | "unsupported";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function ClientPortalSetupPrompt({
  token,
  deferUntilReady = false,
}: {
  token: string;
  deferUntilReady?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const [hint, setHint] = useState("");
  const dismissedKey = useMemo(() => `estateos_portal_setup_${token.slice(-10)}`, [token]);

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isMac = /macintosh|mac os x/i.test(userAgent);

  const registerPush = async (askPermission: boolean) => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setNotifyState("unsupported");
      setHint("Ta przeglądarka nie obsługuje powiadomień Push. Live Chat nadal odświeża się automatycznie.");
      return;
    }
    if (isIos && !isStandalone()) {
      setNotifyState("idle");
      setHint("Na iPhonie najpierw dodaj panel do ekranu początkowego, otwórz go z ikony i wtedy włącz powiadomienia.");
      return;
    }

    setNotifyState("busy");
    try {
      const permission = askPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setNotifyState(permission === "denied" ? "blocked" : "idle");
        setHint(
          permission === "denied"
            ? "Powiadomienia są zablokowane. Włącz je w ustawieniach tej witryny w przeglądarce."
            : "Kliknij ponownie, kiedy chcesz włączyć powiadomienia.",
        );
        return;
      }

      const configRes = await fetch(`/api/crm/client-portal/${token}/push`, { cache: "no-store" });
      const config = await configRes.json();
      if (!configRes.ok || !config.publicKey) {
        throw new Error(config.error || "Powiadomienia Push nie są jeszcze dostępne.");
      }

      const registration = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(String(config.publicKey)),
        });
      }

      const saveRes = await fetch(`/api/crm/client-portal/${token}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) throw new Error(saved.error || "Nie udało się zapisać powiadomień.");

      setNotifyState("enabled");
      setHint("Gotowe — odpowiedź agenta pojawi się natychmiast, także gdy panel będzie w tle.");
    } catch (error) {
      setNotifyState("idle");
      if (!askPermission) {
        setHint("");
        return;
      }
      const message = error instanceof Error ? error.message : "";
      setHint(
        /registration failed|push service not available|aborterror/i.test(message)
          ? "Ta przeglądarka nie udostępnia usługi Push. Live Chat nadal odświeża się automatycznie."
          : message || "Nie udało się włączyć powiadomień. Spróbuj ponownie w ustawieniach przeglądarki.",
      );
    }
  };

  useEffect(() => {
    if (deferUntilReady) {
      setVisible(false);
      return;
    }
    const installStateFrame = window.requestAnimationFrame(() => setInstalled(isStandalone()));
    let dismissedRecently = false;
    try {
      const dismissedAt = Number(window.localStorage.getItem(dismissedKey) || 0);
      dismissedRecently = Boolean(dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1_000);
    } catch {
      /* pokaż prompt */
    }
    const timer = dismissedRecently ? null : window.setTimeout(() => setVisible(true), 900);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHint("Panel jest już dostępny jako osobna ikona.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const pushTimer =
      "Notification" in window && Notification.permission === "granted"
        ? window.setTimeout(() => void registerPush(false), 0)
        : null;
    const workerTimer =
      "serviceWorker" in navigator
        ? window.setTimeout(() => {
            void navigator.serviceWorker.register("/portal-sw.js", { scope: "/" }).catch(() => {});
          }, 0)
        : null;

    return () => {
      window.cancelAnimationFrame(installStateFrame);
      if (timer !== null) window.clearTimeout(timer);
      if (pushTimer !== null) window.clearTimeout(pushTimer);
      if (workerTimer !== null) window.clearTimeout(workerTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // Prompt jest inicjalizowany jeden raz dla danego panelu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedKey, deferUntilReady]);

  if (!visible) return null;

  const install = async () => {
    if (installed) {
      setHint("Panel jest już dodany jako aplikacja na tym urządzeniu.");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setInstallPrompt(null);
        setHint("Panel został dodany. Otwieraj go teraz jednym dotknięciem.");
      }
      return;
    }
    if (isIos) {
      setHint("Safari: dotknij Udostępnij ⤴, wybierz „Do ekranu początkowego”, a potem „Dodaj”.");
      return;
    }
    setHint(
      "W menu przeglądarki wybierz „Zainstaluj aplikację” lub „Utwórz skrót”. Możesz też zapisać stronę w zakładkach.",
    );
  };

  const bookmark = () => {
    setHint(
      isIos
        ? "Safari: Udostępnij ⤴ → Dodaj zakładkę."
        : `Naciśnij ${isMac ? "⌘ D" : "Ctrl + D"}, aby zapisać ten panel w zakładkach.`,
    );
  };

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissedKey, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <section className="relative overflow-hidden rounded-[1.45rem] border border-sky-400/25 bg-gradient-to-r from-sky-500/10 via-[var(--eos-card)] to-emerald-500/10 p-4 shadow-[0_12px_36px_rgba(14,165,233,0.08)] sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
        aria-label="Przypomnij później"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/14 text-sky-600">
          {notifyState === "enabled" ? <CheckCircle2 className="size-5" /> : <BellRing className="size-5" />}
        </div>
        <div>
          <p className="text-sm font-black text-[var(--eos-text)]">Miej swój panel zawsze pod ręką</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
            Dodaj ikonę Panelu EstateOS i włącz powiadomienia. Nie przegapisz odpowiedzi ani ważnej wiadomości od agenta.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void registerPush(true)}
          disabled={notifyState === "busy" || notifyState === "enabled"}
          className="eos-btn eos-btn--primary eos-btn--sm disabled:opacity-60"
        >
          {notifyState === "enabled" ? <CheckCircle2 className="size-4" /> : <BellRing className="size-4" />}
          {notifyState === "busy"
            ? "Włączam…"
            : notifyState === "enabled"
              ? "Powiadomienia aktywne"
              : notifyState === "blocked"
                ? "Powiadomienia zablokowane"
                : "Włącz powiadomienia"}
        </button>
        <button type="button" onClick={() => void install()} className="eos-btn eos-btn--secondary eos-btn--sm">
          {isIos ? <Share2 className="size-4" /> : installed ? <Smartphone className="size-4" /> : <Download className="size-4" />}
          {installed ? "Panel zainstalowany" : "Dodaj ikonę / skrót"}
        </button>
        <button type="button" onClick={bookmark} className="eos-btn eos-btn--secondary eos-btn--sm">
          <Bookmark className="size-4" />
          Dodaj zakładkę
        </button>
      </div>

      {hint ? (
        <p className="mt-3 rounded-xl bg-[var(--eos-input)] px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--eos-text)]">
          {hint}
        </p>
      ) : null}
    </section>
  );
}
