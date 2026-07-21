"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CONTACT_UNREAD_REFRESH_EVENT,
  fetchContactThreadsWeb,
} from "@/lib/contactServiceWeb";

type NavUnread = {
  messages: number;
  notifications: number;
  total: number;
};

const EMPTY: NavUnread = { messages: 0, notifications: 0, total: 0 };

/** Combined unread for hamburger badge (messages + notifications). */
export function useNavUnreadBadge(enabled: boolean): NavUnread {
  const [unread, setUnread] = useState<NavUnread>(EMPTY);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnread(EMPTY);
      return;
    }
    try {
      const profileRes = await fetch("/api/user/profile", {
        cache: "no-store",
        credentials: "include",
      });
      const profile = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok || !(profile?.id || profile?.user?.id)) {
        setUnread(EMPTY);
        return;
      }

      const [threads, notifRes] = await Promise.all([
        fetchContactThreadsWeb().catch(() => ({ totalUnread: 0 })),
        fetch("/api/notifications", { credentials: "include", cache: "no-store" }).catch(() => null),
      ]);

      let notifications = 0;
      if (notifRes?.ok) {
        const data = await notifRes.json().catch(() => null);
        const list = Array.isArray(data) ? data : Array.isArray(data?.notifications) ? data.notifications : [];
        notifications = list.filter((n: { isRead?: boolean }) => !n?.isRead).length;
      }

      const messages = Number(threads.totalUnread || 0);
      setUnread({
        messages,
        notifications,
        total: messages + notifications,
      });
    } catch {
      /* keep previous */
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onRefresh = () => void refresh();
    window.addEventListener(CONTACT_UNREAD_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(CONTACT_UNREAD_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [enabled, refresh]);

  return unread;
}
