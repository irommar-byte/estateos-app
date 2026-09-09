"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTACT_UNREAD_REFRESH_EVENT,
  fetchContactThreadsWeb,
} from "@/lib/contactServiceWeb";
import { showWebNotification } from "@/lib/webNotifications";

type NavUnread = {
  messages: number;
  notifications: number;
  total: number;
};

const EMPTY: NavUnread = { messages: 0, notifications: 0, total: 0 };

/** Combined unread for hamburger badge (messages + notifications). */
export function useNavUnreadBadge(enabled: boolean): NavUnread {
  const [unread, setUnread] = useState<NavUnread>(EMPTY);
  const primed = useRef(false);
  const lastMessageUnread = useRef(0);
  const seenNotifIds = useRef<Set<string>>(new Set());

  const authedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnread(EMPTY);
      authedRef.current = false;
      return;
    }
    try {
      if (!authedRef.current) {
        const profileRes = await fetch("/api/user/profile", {
          cache: "no-store",
          credentials: "include",
        });
        const profile = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok || !(profile?.id || profile?.user?.id)) {
          setUnread(EMPTY);
          return;
        }
        authedRef.current = true;
      }

      const [threads, notifRes] = await Promise.all([
        fetchContactThreadsWeb().catch(() => ({ totalUnread: 0 })),
        fetch("/api/notifications", { credentials: "include", cache: "no-store" }).catch(() => null),
      ]);

      let notifications = 0;
      let list: Array<{ id?: string; title?: string; body?: string; type?: string; isRead?: boolean }> = [];
      if (notifRes?.ok) {
        const data = await notifRes.json().catch(() => null);
        list = Array.isArray(data) ? data : Array.isArray(data?.notifications) ? data.notifications : [];
        notifications = list.filter((n) => !n?.isRead).length;
      }

      const messages = Number(threads.totalUnread || 0);
      const listIds = list.map((n) => String(n.id || "")).filter(Boolean);
      if (!primed.current) {
        primed.current = true;
        lastMessageUnread.current = messages;
        seenNotifIds.current = new Set(listIds);
      } else {
        if (messages > lastMessageUnread.current) {
          showWebNotification("Wiadomość od klienta", {
            body: "Nowa wiadomość w live chat / Contact.",
            tag: "estateos-agent-chat",
            onClickPath: "/moje-konto/wiadomosci",
          });
        }
        for (const n of list) {
          const id = String(n.id || "");
          if (!id || seenNotifIds.current.has(id)) continue;
          if (n.type === "MESSAGE" || String(n.title || "").toLowerCase().includes("wiadomość")) {
            showWebNotification(String(n.title || "Wiadomość od klienta"), {
              body: String(n.body || "").slice(0, 140),
              tag: `estateos-agent-note-${id}`,
              onClickPath: "/moje-konto/wiadomosci",
            });
          }
          seenNotifIds.current.add(id);
        }
        lastMessageUnread.current = messages;
      }
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
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void tick();
    if (!enabled) return;
    const interval = window.setInterval(tick, 30_000);
    const onRefresh = () => void refresh();
    window.addEventListener(CONTACT_UNREAD_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(CONTACT_UNREAD_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  return unread;
}
