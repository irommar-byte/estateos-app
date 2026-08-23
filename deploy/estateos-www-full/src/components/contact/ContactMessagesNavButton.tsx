"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CONTACT_UNREAD_REFRESH_EVENT,
  fetchContactThreadsWeb,
} from "@/lib/contactServiceWeb";

type Props = {
  compact?: boolean;
  className?: string;
};

export default function ContactMessagesNavButton({ compact = false, className = "" }: Props) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/user/profile", { cache: "no-store", credentials: "include" });
      const profile = await res.json().catch(() => ({}));
      if (!res.ok || !(profile?.id || profile?.user?.id)) {
        setUnread(0);
        return;
      }
      const { totalUnread } = await fetchContactThreadsWeb();
      setUnread(totalUnread);
    } catch {
      if (!silent) setUnread(0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const interval = window.setInterval(() => void refresh(true), 30_000);
    const onRefresh = () => void refresh(true);
    window.addEventListener(CONTACT_UNREAD_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(CONTACT_UNREAD_REFRESH_EVENT, onRefresh);
    };
  }, [refresh]);

  const badge = unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;

  return (
    <button
      type="button"
      onClick={() => router.push("/moje-konto/wiadomosci")}
      aria-label={`Wiadomości${badge ? `, ${badge} nieprzeczytanych` : ""}`}
      className={`group relative overflow-visible rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] transition-colors hover:border-emerald-500/30 ${
        compact ? "p-1.5" : "p-2"
      } ${className}`}
    >
      <MessageCircle
        className={`text-[var(--eos-muted)] transition-colors group-hover:text-emerald-500 ${
          compact ? "size-4" : "size-5"
        }`}
        aria-hidden
      />
      {badge ? <span className="eos-nav-unread">{badge}</span> : null}
      {!loading && unread === 0 ? null : null}
    </button>
  );
}
