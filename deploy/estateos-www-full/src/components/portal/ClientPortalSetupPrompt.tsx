"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, ExternalLink, Share2, Smartphone, X } from "lucide-react";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
import { openIosAppOrAppStore } from "@/lib/estateosAppLinks";
import { openInSystemBrowser } from "@/lib/inAppBrowser";
import {
  canEnablePortalPush,
  isPortalStandalone,
  portalInstallGuide,
  resolvePortalInstallSurface,
} from "@/lib/portalInstallGuide";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NotifyState = "idle" | "busy" | "enabled" | "blocked" | "unsupported";

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
  const surface = useMemo(
    () => resolvePortalInstallSurface(typeof navigator !== "undefined" ? navigator.userAgent : ""),
    [],
  );
  const guide = portalInstallGuide(surface);
  const pushReady = canEnablePortalPush({ surface, standalone: installed });

  const registerPush = async (askPermission: boolean) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotifyState("unsupported");
      setHint("Ta przeglądarka nie obsługuje powiadomień. Live Chat i tak odświeża się sam.");
      return;
    }
    if (!canEnablePortalPush({ surface, standalone: isPortalStandalone() })) {
      setNotifyState("idle");
      if (askPermission) {
        setHint(
          "Na iPhonie powiadomienia działają dopiero po dodaniu znaczka i otwarciu panelu z ikony na ekranie początkowym.",
        );
      }
      return;
    }

    setNotifyState("busy");
    try {
      const permission = askPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setNotifyState(permission === "denied" ? "blocked" : "idle");
        setHint(
          permission === "denied"
            ? "Powiadomienia są zablokowane. Włącz je w Ustawieniach iPhone’a → EstateOS (albo Safari) → Powiadomienia."
            : "Kliknij ponownie, gdy będziesz gotowy włączyć powiadomienia.",
        );
        return;
      }

      const configRes = await fetch(`/api/crm/client-portal/${token}/push`, { cache: "no-store" });
      const config = await configRes.json();
      if (!configRes.ok || !config.publicKey) {
        throw new Error(config.error || "Powiadomienia nie są jeszcze dostępne.");
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
      setHint("Gotowe. Odpowiedź agenta dotrze na telefon, także gdy panel jest zamknięty.");
    } catch (error) {
      setNotifyState("idle");
      if (!askPermission) {
        setHint("");
        return;
      }
      const message = error instanceof Error ? error.message : "";
      setHint(
        /registration failed|push service not available|aborterror/i.test(message)
          ? "Ta przeglądarka nie udostępnia usługi Push. Live Chat nadal działa w panelu."
          : message || "Nie udało się włączyć powiadomień. Spróbuj ponownie po otwarciu panelu z ikony.",
      );
    }
  };

  useEffect(() => {
    if (deferUntilReady) {
      setVisible(false);
      return;
    }
    const syncInstalled = () => setInstalled(isPortalStandalone());
    syncInstalled();
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", syncInstalled);

    let dismissedRecently = false;
    try {
      const dismissedAt = Number(window.localStorage.getItem(dismissedKey) || 0);
      dismissedRecently = Boolean(dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1_000);
    } catch {
      /* pokaż prompt */
    }

    const standaloneNow = isPortalStandalone();
    const pushPending =
      "Notification" in window && Notification.permission !== "granted" && standaloneNow;
    const timer =
      dismissedRecently && !pushPending ? null : window.setTimeout(() => setVisible(true), 700);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHint("Znaczek jest na telefonie. Otwórz panel z ikony i włącz powiadomienia w kroku 2.");
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
      media.removeEventListener?.("change", syncInstalled);
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
    if (guide.needsSafariFirst) {
      openInSystemBrowser(window.location.href);
      setHint(
        surface === "ios-iab"
          ? "Otwórz panel w Safari, potem: Udostępnij → Do ekranu początkowego → Dodaj. Wejdź z nowej ikony."
          : "Otwórz panel w Chrome, potem dodaj go na ekran główny.",
      );
      return;
    }
    if (installed) {
      setHint("Ikona jest już na tym urządzeniu. Jeśli nie widzisz kroku 2, otwórz panel właśnie z tej ikony.");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setInstallPrompt(null);
        setHint("Panel został dodany. Otwórz go z ikony i włącz powiadomienia poniżej.");
      }
      return;
    }
    setHint(
      surface === "ios-safari"
        ? "Zrób to teraz: Udostępnij (strzałka w górę na dole) → Do ekranu początkowego → Dodaj. Potem wejdź z nowej ikony."
        : guide.steps.join(" "),
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

  const allDone =
    notifyState === "enabled" && (installed || !guide.pushLockedUntilStandalone);

  return (
    <section className="relative overflow-hidden rounded-[1.45rem] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/8 via-[var(--eos-card)] to-sky-500/8 p-4 shadow-[0_12px_36px_rgba(16,185,129,0.08)] sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
        aria-label="Przypomnij później"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/14 text-emerald-700">
          {allDone ? <CheckCircle2 className="size-5" /> : <Smartphone className="size-5" />}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/80">
            {allDone ? "Gotowe" : "Dwa kroki, żeby nie przegapić agenta"}
          </p>
          <p className="mt-1 text-sm font-black text-[var(--eos-text)]">
            {allDone ? "Panel jest na telefonie, powiadomienia włączone" : "Najpierw znaczek, potem powiadomienia"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
            {allDone
              ? "Możesz zamknąć tę kartę. Wiadomości od agenta przyjdą na telefon."
              : "Ikona na ekranie początkowym działa jak mała aplikacja. Powiadomienia włączysz dopiero po jej otwarciu — tak wymaga telefon."}
          </p>
        </div>
      </div>

      {allDone ? null : (
        <ol className="mt-4 space-y-3">
          <li
            className={`rounded-2xl border p-3.5 ${
              installed
                ? "border-emerald-400/35 bg-emerald-500/8"
                : "border-[var(--eos-border)] bg-[var(--eos-card)]/80"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  installed ? "bg-emerald-500 text-white" : "bg-[var(--eos-text)] text-[var(--eos-card)]"
                }`}
              >
                {installed ? <CheckCircle2 className="size-4" /> : "1"}
              </span>
              <p className="text-sm font-black text-[var(--eos-text)]">{guide.step1Title}</p>
            </div>
            <ol className="mt-3 space-y-2">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-[var(--eos-muted)]">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--eos-input)] text-[10px] font-black text-[var(--eos-text)]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => void install()}
              className="eos-btn eos-btn--primary eos-btn--sm mt-3"
            >
              {guide.needsSafariFirst ? (
                <ExternalLink className="size-4" />
              ) : installed ? (
                <Smartphone className="size-4" />
              ) : surface.startsWith("ios") ? (
                <Share2 className="size-4" />
              ) : (
                <Smartphone className="size-4" />
              )}
              {installed ? "Ikona dodana — otwórz ją" : guide.installButton}
            </button>
          </li>

          <li
            className={`rounded-2xl border p-3.5 ${
              notifyState === "enabled"
                ? "border-emerald-400/35 bg-emerald-500/8"
                : pushReady
                  ? "border-emerald-400/30 bg-emerald-500/6"
                  : "border-[var(--eos-border)] bg-[var(--eos-input)]/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  notifyState === "enabled"
                    ? "bg-emerald-500 text-white"
                    : pushReady
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--eos-muted)]/35 text-[var(--eos-muted)]"
                }`}
              >
                {notifyState === "enabled" ? <CheckCircle2 className="size-4" /> : "2"}
              </span>
              <p className="text-sm font-black text-[var(--eos-text)]">Włącz powiadomienia</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--eos-muted)]">
              {pushReady
                ? "Jesteś w panelu z ikony. Kliknij przycisk i zaakceptuj prośbę telefonu — wtedy wiadomości od agenta przyjdą od razu."
                : "Ten przycisk odblokuje się, gdy otworzysz panel z ikony na ekranie telefonu (krok 1)."}
            </p>
            <button
              type="button"
              onClick={() => void registerPush(true)}
              disabled={!pushReady || notifyState === "busy" || notifyState === "enabled"}
              className="eos-btn eos-btn--primary eos-btn--sm mt-3 disabled:opacity-45"
            >
              {notifyState === "enabled" ? <CheckCircle2 className="size-4" /> : <BellRing className="size-4" />}
              {notifyState === "busy"
                ? "Włączam…"
                : notifyState === "enabled"
                  ? "Powiadomienia aktywne"
                  : notifyState === "blocked"
                    ? "Powiadomienia zablokowane"
                    : pushReady
                      ? "Włącz powiadomienia"
                      : "Najpierw krok 1"}
            </button>
          </li>
        </ol>
      )}

      {hint ? (
        <p className="mt-3 rounded-xl bg-[var(--eos-input)] px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--eos-text)]">
          {hint}
        </p>
      ) : null}

      {allDone ? null : (
        <div className="mt-4 rounded-2xl bg-[#141416] px-3 py-3.5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Albo gotowa aplikacja</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/80">
            Pobierz EstateOS z App Store. Tam też włączysz powiadomienia — bez dodawania znaczka strony.
          </p>
          <div className="mt-3">
            <AppStoreBadgeLink compact androidComingSoon label="Pobierz EstateOS w App Store" />
          </div>
          {surface.startsWith("ios") ? (
            <button
              type="button"
              onClick={() => {
                setHint("Jeśli apka jest zainstalowana, otworzy ten panel. W przeciwnym razie wejdzie App Store.");
                openIosAppOrAppStore({ portalToken: token, href: window.location.href });
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 underline-offset-2 hover:underline"
            >
              <Smartphone className="size-3.5" />
              Mam już aplikację — otwórz ten panel
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
