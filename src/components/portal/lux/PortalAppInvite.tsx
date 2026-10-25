"use client";

import { useEffect, useState } from "react";
import { Monitor, QrCode, Smartphone } from "lucide-react";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
import { openIosAppOrAppStore } from "@/lib/estateosAppLinks";
import { isPortalStandalone, resolvePortalInstallSurface, type PortalInstallSurface } from "@/lib/portalInstallGuide";

type Invite = { code: string; link: string; qrSvg?: string; expiresAt?: string | null };

function expiryLabel(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/**
 * Karta „Panel na telefonie” dopasowana do urządzenia:
 *  • komputer — QR do zeskanowania aparatem (działa na każdym telefonie),
 *  • Android — panel jako aplikacja z ekranu głównego (bez sklepu),
 *  • iPhone — to samo albo aplikacja EstateOS z App Store (kod 6 cyfr).
 */
export default function PortalAppInvite({
  invite,
  token,
  onShowInstall,
}: {
  invite: Invite;
  token?: string;
  /** przewija do karty „Dodaj na ekran telefonu” */
  onShowInstall?: () => void;
}) {
  const [surface, setSurface] = useState<PortalInstallSurface | null>(null);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    // Wykrycie urządzenia dopiero w przeglądarce (bez rozjazdu renderu serwera).
    const id = window.setTimeout(() => {
      setSurface(resolvePortalInstallSurface(navigator.userAgent));
      setStandalone(isPortalStandalone());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!surface) return null;

  const isIos = surface.startsWith("ios");
  const isAndroid = surface.startsWith("android");
  const code = (
    <span className="font-mono text-[24px] font-bold tracking-[0.28em] text-[var(--lux-ink)]" aria-label={`Kod: ${invite.code.split("").join(" ")}`}>
      {invite.code.slice(0, 3)} {invite.code.slice(3)}
    </span>
  );
  const expiry = expiryLabel(invite.expiresAt);

  if (surface === "desktop") {
    return (
      <section className="lux-card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          {invite.qrSvg ? (
            <div
              className="mx-auto size-[168px] shrink-0 overflow-hidden rounded-2xl border border-[var(--lux-line)] bg-white p-2 sm:mx-0 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="lux-kicker flex items-center gap-2">
              <QrCode className="size-4" aria-hidden /> Panel na telefonie
            </p>
            <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">Zeskanuj aparatem telefonu</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
              Działa na każdym telefonie — iPhone i Android. Panel otworzy się w przeglądarce; możesz dodać go na ekran
              główny jak aplikację i włączyć powiadomienia.
            </p>
            <p className="mt-3 text-[12px] text-[var(--lux-ink-3)]">
              Masz iPhone&apos;a z aplikacją EstateOS? Wpisz w niej kod {code}
            </p>
            {expiry ? <p className="mt-1 text-[11px] text-[var(--lux-ink-3)]">Kod ważny do: {expiry}. QR nie wygasa.</p> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="lux-card overflow-hidden p-5">
      <p className="lux-kicker flex items-center gap-2">
        <Smartphone className="size-4" aria-hidden /> {standalone ? "Panel na ekranie telefonu" : "Panel jak aplikacja"}
      </p>
      <h3 className="lux-serif mt-1.5 text-[21px] font-medium leading-tight">
        {standalone ? "Wszystko gotowe" : isAndroid ? "Dodaj panel do ekranu głównego" : "Ikona na ekranie albo aplikacja"}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
        {standalone
          ? "Otwierasz panel z ikony — wiadomości od agenta przyjdą jako powiadomienia, jeśli je włączysz."
          : isAndroid
            ? "Nie trzeba niczego pobierać ze sklepu. Panel zachowa się jak aplikacja: własna ikona, pełny ekran i powiadomienia od agenta."
            : "Najprościej: dodaj panel na ekran początkowy — działa jak aplikacja. Albo pobierz EstateOS z App Store."}
      </p>
      {!standalone && onShowInstall ? (
        <button type="button" onClick={onShowInstall} className="lux-btn lux-btn--ink mt-4 w-full sm:w-auto">
          <Smartphone className="size-4" /> Pokaż, jak dodać ikonę
        </button>
      ) : null}

      {isIos ? (
        <div className="mt-5 rounded-2xl bg-[var(--lux-well)] p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--lux-gold-ink)]">Aplikacja EstateOS</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
            Pobierz aplikację, wybierz „Mam kod od agenta” i wpisz {code}
          </p>
          {expiry ? <p className="mt-1 text-[11px] text-[var(--lux-ink-3)]">Kod ważny do: {expiry}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <AppStoreBadgeLink compact appleOnly label="Pobierz EstateOS w App Store" />
            <button
              type="button"
              onClick={() => openIosAppOrAppStore({ portalToken: token || null, href: window.location.href })}
              className="text-[12px] font-bold text-[var(--lux-accent)] underline underline-offset-2"
            >
              Mam już aplikację — otwórz panel
            </button>
          </div>
        </div>
      ) : null}

      {isAndroid ? (
        <p className="mt-4 flex items-center gap-2 text-[11px] text-[var(--lux-ink-3)]">
          <Monitor className="size-3.5" /> Na komputerze ten sam panel otworzysz z linku od agenta.
        </p>
      ) : null}
    </section>
  );
}
