"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BellRing, CheckCircle2, ChevronDown, ExternalLink, QrCode, Smartphone } from "lucide-react";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
import { usePortalLocale } from "@/components/portal/PortalLocale";
import { openIosAppOrAppStore } from "@/lib/estateosAppLinks";
import { openInSystemBrowser } from "@/lib/inAppBrowser";
import { isPortalStandalone, resolvePortalInstallSurface, type PortalInstallSurface } from "@/lib/portalInstallGuide";

type Invite = { code: string; link: string; qrSvg?: string; expiresAt?: string | null };

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

/**
 * „Panel na telefonie” — jedna krótka karta dopasowana do urządzenia:
 *  • iPhone — przeniesienie panelu do aplikacji EstateOS (App Store / kod), ikona jako alternatywa,
 *  • Android — panel jako aplikacja z ekranu głównego + powiadomienia,
 *  • komputer — QR do zeskanowania telefonem,
 *  • otwarty z ikony — już tylko włączenie powiadomień (po włączeniu karta znika).
 */
export default function ClientPortalSetupPrompt({
  token,
  invite,
  allowPush,
}: {
  token: string;
  invite?: Invite | null;
  /** właściciel panelu (nie partner) może zapisać powiadomienia */
  allowPush: boolean;
}) {
  const { t, dateLocale } = usePortalLocale();
  const [surface, setSurface] = useState<PortalInstallSurface | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const [hint, setHint] = useState("");

  const isIos = surface?.startsWith("ios") ?? false;
  const pushPossible = allowPush && (standalone || surface === "android" || surface === "desktop");

  const registerPush = async (askPermission: boolean) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotifyState("unsupported");
      if (askPermission) setHint(t("Ta przeglądarka nie obsługuje powiadomień. Wiadomości zobaczysz w panelu."));
      return;
    }
    setNotifyState("busy");
    try {
      const permission = askPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setNotifyState(permission === "denied" ? "blocked" : "idle");
        if (permission === "denied") {
          setHint(t("Powiadomienia są zablokowane — włącz je w ustawieniach telefonu lub przeglądarki."));
        }
        return;
      }
      const configRes = await fetch(`/api/crm/client-portal/${token}/push`, { cache: "no-store" });
      const config = await configRes.json();
      if (!configRes.ok || !config.publicKey) throw new Error("push-config");

      const registration = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(String(config.publicKey)),
        }));
      const saveRes = await fetch(`/api/crm/client-portal/${token}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saveRes.ok) throw new Error("push-save");
      setNotifyState("enabled");
      if (askPermission) setHint(t("Gotowe — wiadomości od agenta przyjdą na telefon, także gdy panel jest zamknięty."));
    } catch {
      setNotifyState("idle");
      if (askPermission) setHint(t("Nie udało się włączyć powiadomień. Spróbuj ponownie za chwilę."));
    }
  };

  useEffect(() => {
    // Wykrycie urządzenia dopiero w przeglądarce (bez rozjazdu renderu serwera).
    const id = window.setTimeout(() => {
      setSurface(resolvePortalInstallSurface(navigator.userAgent));
      setStandalone(isPortalStandalone());
      if (allowPush && "Notification" in window && Notification.permission === "granted") void registerPush(false);
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register("/portal-sw.js", { scope: "/" }).catch(() => {});
      }
    }, 0);
    const media = window.matchMedia("(display-mode: standalone)");
    const syncStandalone = () => setStandalone(isPortalStandalone());
    media.addEventListener?.("change", syncStandalone);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setHint(t("Ikona jest na ekranie. Otwórz panel z niej, żeby włączyć powiadomienia."));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(id);
      media.removeEventListener?.("change", syncStandalone);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // Inicjalizacja raz na panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, allowPush]);

  if (!surface) return null;
  // Panel z ikony i powiadomienia już działają (albo nie da się ich włączyć) — nic więcej do zrobienia.
  if (standalone && (!pushPossible || notifyState === "enabled" || notifyState === "unsupported")) return null;

  const code = invite ? (
    <span className="font-mono text-[15px] font-bold tracking-[0.22em] text-[var(--lux-ink)]">
      {invite.code.slice(0, 3)} {invite.code.slice(3)}
    </span>
  ) : null;
  const expiry = (() => {
    if (!invite?.expiresAt) return null;
    const d = new Date(invite.expiresAt);
    return Number.isFinite(d.getTime())
      ? d.toLocaleString(dateLocale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : null;
  })();

  const steps = (items: string[]) => (
    <ol className="mt-3 space-y-2">
      {items.map((step, index) => (
        <li key={step} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--lux-well)] text-[10px] font-bold text-[var(--lux-ink)]">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );

  const pushRow = pushPossible ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--lux-well)] p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--lux-card)] text-[var(--lux-gold-ink)]">
        {notifyState === "enabled" ? <CheckCircle2 className="size-4" /> : <BellRing className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--lux-ink)]">{t("Powiadomienia od agenta")}</p>
        <p className="text-[12px] leading-snug text-[var(--lux-ink-3)]">
          {notifyState === "enabled"
            ? t("Włączone na tym urządzeniu.")
            : notifyState === "blocked"
              ? t("Zablokowane w ustawieniach.")
              : t("Nowa wiadomość lub termin od razu na telefonie.")}
        </p>
      </div>
      {notifyState === "enabled" || notifyState === "unsupported" ? null : (
        <button
          type="button"
          onClick={() => void registerPush(true)}
          disabled={notifyState === "busy" || notifyState === "blocked"}
          className="lux-btn lux-btn--ink shrink-0 disabled:opacity-45"
        >
          {notifyState === "busy" ? t("Włączam…") : t("Włącz")}
        </button>
      )}
    </div>
  ) : null;

  const hintBox = hint ? (
    <p className="mt-3 rounded-xl bg-[var(--lux-well)] px-3 py-2 text-[12px] font-medium leading-relaxed text-[var(--lux-ink)]">
      {hint}
    </p>
  ) : null;

  const kicker = (icon: ReactNode, label: string) => (
    <p className="lux-kicker flex items-center gap-2">
      {icon} {label}
    </p>
  );

  if (standalone) {
    return (
      <section id="portal-install" className="lux-card scroll-mt-24 p-5">
        {kicker(<Smartphone className="size-4" aria-hidden />, t("Panel na telefonie"))}
        <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">{t("Ostatni krok: powiadomienia")}</h3>
        {pushRow}
        {hintBox}
      </section>
    );
  }

  if (surface === "desktop") {
    return (
      <section id="portal-install" className="lux-card scroll-mt-24 overflow-hidden p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {invite?.qrSvg ? (
            <div
              className="mx-auto size-[156px] shrink-0 overflow-hidden rounded-2xl border border-[var(--lux-line)] bg-white p-2 sm:mx-0 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {kicker(<QrCode className="size-4" aria-hidden />, t("Panel na telefonie"))}
            <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">{t("Zeskanuj aparatem telefonu")}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
              {t("Działa na iPhonie i Androidzie — ten sam panel otworzy się na telefonie.")}
            </p>
            {code ? (
              <p className="mt-2 text-[12px] text-[var(--lux-ink-3)]">
                {t("W aplikacji EstateOS możesz też wpisać kod")} {code}
                {expiry ? <span className="block text-[11px]">{t("Kod ważny do {date}.", { date: expiry })}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
        {pushRow}
        {hintBox}
      </section>
    );
  }

  if (isIos) {
    return (
      <section id="portal-install" className="lux-card scroll-mt-24 p-5">
        {kicker(<Smartphone className="size-4" aria-hidden />, t("Panel na telefonie"))}
        <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">{t("Przenieś panel do aplikacji")}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
          {t("Bezpłatna aplikacja EstateOS otworzy ten panel i powiadomi Cię o każdej wiadomości od agenta.")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openIosAppOrAppStore({ portalToken: token, href: window.location.href })}
            className="lux-btn lux-btn--ink"
          >
            <Smartphone className="size-4" /> {t("Otwórz w aplikacji")}
          </button>
          <AppStoreBadgeLink compact appleOnly label={t("Pobierz EstateOS w App Store")} />
        </div>
        {code ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--lux-ink-3)]">
            {t("Po instalacji wybierz „Mam kod od agenta” i wpisz")} {code}
            {expiry ? <span className="block text-[11px]">{t("Kod ważny do {date}.", { date: expiry })}</span> : null}
          </p>
        ) : null}

        <details className="group mt-4 rounded-2xl bg-[var(--lux-well)] px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-[var(--lux-ink)]">
            {t("Bez aplikacji — ikona na ekranie")}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          {surface === "ios-iab" ? (
            <>
              {steps([
                t("Otwórz panel w Safari."),
                t("Stuknij Udostępnij, potem „Do ekranu początkowego” → „Dodaj”."),
                t("Wejdź w panel z nowej ikony i włącz powiadomienia."),
              ])}
              <button
                type="button"
                onClick={() => openInSystemBrowser(window.location.href)}
                className="lux-btn lux-btn--ghost mt-3"
              >
                <ExternalLink className="size-4" /> {t("Otwórz w Safari")}
              </button>
            </>
          ) : (
            steps([
              t("Stuknij Udostępnij na dole ekranu."),
              t("Wybierz „Do ekranu początkowego” → „Dodaj”."),
              t("Wejdź w panel z nowej ikony i włącz powiadomienia."),
            ])
          )}
        </details>
        {hintBox}
      </section>
    );
  }

  // Android
  const installNow = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setHint(t("Ikona jest na ekranie. Otwórz panel z niej, żeby włączyć powiadomienia."));
    }
  };
  return (
    <section id="portal-install" className="lux-card scroll-mt-24 p-5">
      {kicker(<Smartphone className="size-4" aria-hidden />, t("Panel na telefonie"))}
      <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">{t("Dodaj panel do ekranu głównego")}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
        {t("Bez pobierania ze sklepu — własna ikona, pełny ekran i powiadomienia od agenta.")}
      </p>
      {surface === "android-iab" ? (
        <button type="button" onClick={() => openInSystemBrowser(window.location.href)} className="lux-btn lux-btn--ink mt-4">
          <ExternalLink className="size-4" /> {t("Otwórz w Chrome")}
        </button>
      ) : installPrompt ? (
        <button type="button" onClick={() => void installNow()} className="lux-btn lux-btn--ink mt-4">
          <Smartphone className="size-4" /> {t("Dodaj na ekran główny")}
        </button>
      ) : (
        steps([
          t("Otwórz menu ⋮ w prawym górnym rogu."),
          t("Wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”."),
        ])
      )}
      {surface === "android" ? pushRow : null}
      {hintBox}
    </section>
  );
}
