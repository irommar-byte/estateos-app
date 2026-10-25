"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, ChevronDown, Circle } from "lucide-react";
import LuxSheet from "@/components/portal/lux/LuxSheet";
import { NOTICE_GROUP_LABEL, type PortalNotice } from "@/lib/crm/portalNotices";

/** Przeczytane powiadomienia — pamiętane w tej przeglądarce (id są stabilne). */
export function useNoticeReadState(token: string | null) {
  const key = token ? `eos-portal-notices-read:${token}` : null;
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      setRead(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      /* ignore */
    }
  }, [key]);
  const save = useCallback(
    (next: Set<string>) => {
      if (!key) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(Array.from(next).slice(-400)));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  const markRead = useCallback(
    (ids: string[]) =>
      setRead((cur) => {
        const next = new Set(cur);
        ids.forEach((id) => next.add(id));
        save(next);
        return next;
      }),
    [save],
  );
  return { read, markRead };
}

function relTime(at: string | null) {
  if (!at) return "";
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return new Date(at).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  const min = Math.round(diff / 60000);
  if (min < 1) return "teraz";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  return d === 1 ? "wczoraj" : `${d} dni temu`;
}

const plNew = (n: number) => (n === 1 ? "nowa rzecz" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "nowe rzeczy" : "nowych rzeczy");

/**
 * Dzwonek w prawym górnym rogu: dzwoni, gdy jest coś nowego, i podpowiada „przewiń w dół”.
 * Po kliknięciu: ile nowych, ile przeczytanych; dotknięcie powiadomienia przenosi w odpowiednie miejsce.
 */
export default function PortalNotificationsBell({
  notices,
  read,
  onMarkRead,
  onNavigate,
  variant = "header",
}: {
  notices: PortalNotice[];
  read: Set<string>;
  onMarkRead: (ids: string[]) => void;
  onNavigate: (notice: PortalNotice) => void;
  /** header — w czarnym nagłówku z podpowiedzią „zjedź niżej”; bar — mały, w przypiętym pasku */
  variant?: "header" | "bar";
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "read" | "all">("new");
  const fresh = useMemo(() => notices.filter((n) => !read.has(n.id)), [notices, read]);
  const seen = useMemo(() => notices.filter((n) => read.has(n.id)), [notices, read]);
  const list = tab === "new" ? fresh : tab === "read" ? seen : notices;

  const openSheet = () => {
    setTab(fresh.length ? "new" : "all");
    setOpen(true);
  };

  const go = (notice: PortalNotice) => {
    onMarkRead([notice.id]);
    setOpen(false);
    window.setTimeout(() => onNavigate(notice), 180);
  };

  const ringing = fresh.length > 0;
  const button = (
    <button
      type="button"
      onClick={openSheet}
      aria-label={ringing ? `Powiadomienia: ${fresh.length} nowych` : "Powiadomienia"}
      className={`relative flex items-center justify-center rounded-full border border-[#D8C3A0]/35 ${
        variant === "header" ? "size-10" : "size-9"
      } ${ringing ? "eos-bell-halo" : ""}`}
    >
      {ringing ? (
        <BellRing className="eos-bell-ring size-[18px] text-[#D8C3A0]" />
      ) : (
        <Bell className="size-[17px] text-[#D8C3A0]" />
      )}
      {ringing ? (
        <span className="eos-badge-blink absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#C2412D] px-1 text-[10.5px] font-extrabold text-white">
          {fresh.length > 9 ? "9+" : fresh.length}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        {button}
        {ringing && variant === "header" ? (
          <button
            type="button"
            onClick={() => go(fresh[0])}
            className="flex items-center gap-1 rounded-full bg-[#D8C3A0] px-2.5 py-1 text-[11px] font-bold text-black"
          >
            {fresh.length} {plNew(fresh.length)} — zjedź niżej
            <ChevronDown className="eos-scroll-hint size-3.5" />
          </button>
        ) : null}
      </div>


      <LuxSheet open={open} onClose={() => setOpen(false)} kicker="Powiadomienia" title={fresh.length ? `${fresh.length} ${plNew(fresh.length)}` : "Wszystko przeczytane"}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { k: "new" as const, label: "Nowe", n: fresh.length },
            { k: "read" as const, label: "Przeczytane", n: seen.length },
            { k: "all" as const, label: "Wszystkie", n: notices.length },
          ].map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={`rounded-[16px] border px-3 py-2.5 text-left ${tab === t.k ? "border-black bg-black text-[#D8C3A0]" : "border-[#E6E0D6] bg-white text-[#15171A]"}`}
            >
              <span className="lux-serif block text-[24px] leading-none">{t.n}</span>
              <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{t.label}</span>
            </button>
          ))}
        </div>

        {fresh.length ? (
          <button
            type="button"
            onClick={() => onMarkRead(fresh.map((n) => n.id))}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--lux-accent)]"
          >
            <CheckCheck className="size-4" /> Oznacz wszystkie jako przeczytane
          </button>
        ) : null}

        <ul className="mt-3 space-y-2">
          {list.length ? (
            list.map((n) => {
              const isNew = !read.has(n.id);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n)}
                    className={`flex w-full items-start gap-3 rounded-[18px] border p-3 text-left transition-colors ${
                      isNew ? "border-[#E9C27A] bg-white" : "border-[#ECE6DC] bg-[#FBF9F5]"
                    }`}
                  >
                    <Circle className={`mt-1 size-2.5 shrink-0 ${isNew ? "fill-[#C2412D] text-[#C2412D]" : "fill-transparent text-[#CFC7BA]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-[#F4EBDA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7A5F33]">
                          {NOTICE_GROUP_LABEL[n.group]}
                        </span>
                        {n.tone === "action" ? <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#C2412D]">do zrobienia</span> : null}
                        <span className="ml-auto shrink-0 text-[11px] text-[#8C877D]">{relTime(n.at)}</span>
                      </span>
                      <span className={`mt-1 block text-[14px] ${isNew ? "font-bold" : "font-semibold text-[#45423C]"}`}>{n.title}</span>
                      {n.body ? <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-[#6F6A61]">{n.body}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="rounded-[18px] bg-white p-5 text-center text-[13px] text-[#6F6A61]">
              {tab === "new" ? "Nie ma nic nowego. Damy znać, gdy coś się pojawi." : "Brak powiadomień."}
            </li>
          )}
        </ul>
      </LuxSheet>
    </>
  );
}
