"use client";

import { portalConfirm, portalToast } from "@/lib/portalUi";
import { useState } from "react";
import { Copy, Share2, Trash2 } from "lucide-react";
import LuxSheet from "./LuxSheet";
import { portalAction } from "./portalApi";
import { usePortalLocale } from "@/components/portal/PortalLocale";

export type PortalCompanion = { id: number; name: string; url: string; lastSeenAt: string | null };

/** Druga osoba: własny link, osobne oceny, wspólna porównywarka. */
export default function PortalPartnerSheet({
  open,
  onClose,
  token,
  companions,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  companions: PortalCompanion[];
  onChanged: () => void;
}) {
  const { t, dateLocale } = usePortalLocale();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<PortalCompanion | null>(null);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const json = await portalAction<{ companion: PortalCompanion }>(token, "create_partner_link", { name });
      setCreated(json.companion);
      setName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Błąd"));
    } finally {
      setBusy(false);
    }
  };

  const share = async (c: PortalCompanion) => {
    const text = `${t("Zapraszam do wspólnego wyboru mieszkania — tu są propozycje od naszego agenta:")} ${c.url}`;
    if (navigator.share) {
      await navigator.share({ title: t("Wspólny wybór mieszkania"), text, url: c.url }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(c.url).catch(() => {});
      portalToast.success(t("Link skopiowany"), t("Wyślij go osobie: {name}.", { name: c.name }));
    }
  };

  const revoke = async (c: PortalCompanion) => {
    const ok = await portalConfirm({
      title: t("Odebrać dostęp: {name}?", { name: c.name }),
      body: t("Ten link przestanie działać od razu. Zawsze możesz zaprosić tę osobę ponownie."),
      confirmLabel: t("Odbierz dostęp"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await portalAction(token, "revoke_partner_link", { companionId: c.id });
      portalToast.success(t("Dostęp odebrany"), t("{name} nie zobaczy już panelu.", { name: c.name }));
    } catch (e) {
      portalToast.error(t("Nie udało się odebrać dostępu"), e);
    }
    onChanged();
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker={t("Wybieramy razem")} title={t("Dostęp dla drugiej osoby")}>
      <p className="text-[14px] leading-relaxed text-[var(--lux-ink-2)]">
        {t("Partner albo ktoś z rodziny dostaje własny link. Ocenia oferty osobno, a w porównaniu widać, gdzie się zgadzacie.")}
      </p>

      {companions.length ? (
        <div className="lux-card mt-4 divide-y divide-[var(--lux-line)] px-4">
          {companions.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{c.name}</p>
                <p className="text-[12px] text-[var(--lux-ink-2)]">
                  {c.lastSeenAt
                    ? t("Ostatnio w panelu: {date}", { date: new Date(c.lastSeenAt).toLocaleDateString(dateLocale) })
                    : t("Jeszcze nie otworzył(a) linku")}
                </p>
              </div>
              <button type="button" onClick={() => void share(c)} aria-label={`${t("Wyślij link")}: ${c.name}`} className="lux-chip">
                <Share2 className="mr-1 size-3.5" /> {t("Wyślij")}
              </button>
              <button type="button" onClick={() => void revoke(c)} aria-label={`${t("Odbierz dostęp")}: ${c.name}`} className="lux-chip">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {created ? (
        <div className="mt-4 rounded-2xl bg-black p-4 text-[#F6F3EE]">
          <p className="text-[13px] font-bold text-[#D8C3A0]">{t("Link dla:")} {created.name}</p>
          <p className="mt-1 break-all text-[12px] text-[#BDB6AA]">{created.url}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="lux-btn lux-btn--primary flex-1" onClick={() => void share(created)}>
              <Share2 className="size-4" /> {t("Wyślij link")}
            </button>
            <button
              type="button"
              className="lux-btn lux-btn--ghost"
              onClick={() => void navigator.clipboard?.writeText(created.url)}
              aria-label={t("Kopiuj link")}
            >
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <label htmlFor="partner-name" className="text-[13px] font-bold">
          {t("Imię osoby, którą zapraszasz")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="partner-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("np. Jan")}
            className="h-12 min-w-0 flex-1 rounded-full border border-[var(--lux-line)] bg-[var(--lux-card)] px-4 text-[15px]"
          />
          <button type="button" className="lux-btn lux-btn--ink" disabled={busy || !name.trim()} onClick={() => void create()}>
            {t("Utwórz link")}
          </button>
        </div>
        {error ? <p className="mt-2 text-[13px] text-[var(--lux-danger)]">{error}</p> : null}
      </div>
    </LuxSheet>
  );
}
