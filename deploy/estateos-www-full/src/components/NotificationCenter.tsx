"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Diamond,
  Flame,
  Info,
  ShieldAlert,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";

type NotificationItem = {
  id: string | number;
  title?: string;
  message?: string;
  type?: string;
  link?: string;
  groupKey?: string;
  createdAt?: string;
  isRead?: boolean;
  ids?: Array<string | number>;
  count?: number;
};

export default function NotificationCenter() {
  const { dict, locale } = useLocale();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch {
      /* keep previous notifications */
    }
  };

  const groupedNotifications = (() => {
    const grouped = new Map<string, NotificationItem>();
    for (const notification of notifications) {
      const key = notification.groupKey || `single:${notification.id}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          ...notification,
          ids: [notification.id],
          count: 1,
          isRead: !!notification.isRead,
        });
      } else {
        existing.ids = [...(existing.ids || []), notification.id];
        existing.count = (existing.count || 1) + 1;
        existing.isRead = !!existing.isRead && !!notification.isRead;
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  })();

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 15_000);
    window.addEventListener("refreshNotifications", fetchNotifications);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("refreshNotifications", fetchNotifications);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const handleNotificationClick = async (notification: NotificationItem) => {
    const idsToRead = Array.isArray(notification.ids) ? notification.ids : [notification.id];

    if (!notification.isRead) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: idsToRead }),
      });
      setNotifications((prev) =>
        prev.map((item) => (idsToRead.includes(item.id) ? { ...item, isRead: true } : item)),
      );
    }

    setIsOpen(false);
    router.push(notification.link || "/moje-konto/crm");
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch {
      /* optimistic update is enough */
    }
  };

  const getIconAndColor = (notification: NotificationItem) => {
    const title = notification.title || "";
    const type = notification.type || "";

    if (title.includes("Deal Room") || title.includes("Wiadomość") || type === "DEAL_UPDATE") {
      return { icon: Briefcase, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    }
    if (title.includes("Oferta Zakupu") || title.includes("💎")) {
      return { icon: Diamond, color: "text-blue-500", bg: "bg-blue-500/10" };
    }
    if (title.includes("Gorąca") || title.includes("VIP")) {
      return { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" };
    }
    if (title.includes("✅") || title.includes("Gratulacje")) {
      return { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    }
    if (title.includes("❌") || title.includes("Odrzucona")) {
      return { icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10" };
    }
    if (title.includes("Concierge")) {
      return { icon: Star, color: "text-[var(--eos-accent)]", bg: "bg-[var(--eos-accent-soft)]" };
    }
    return { icon: Info, color: "text-[var(--eos-muted)]", bg: "bg-[var(--eos-input)]" };
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={dict.notifications.label}
        className="relative rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2.5 text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-colors hover:border-[var(--eos-accent)]/30 hover:text-[var(--eos-accent)]"
      >
        <Bell className={`size-5 ${unreadCount > 0 ? "animate-[wiggle_3s_ease-in-out_infinite]" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-[0_0_14px_rgba(239,68,68,0.55)] ring-2 ring-[var(--eos-bg-elevated)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.75rem)] z-[9999] w-[min(430px,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] text-[var(--eos-text)] shadow-[var(--eos-shadow-strong)] sm:absolute sm:right-0 sm:left-auto sm:top-14 sm:w-[400px] sm:translate-x-0"
          >
            <div className="flex items-center justify-between border-b border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-4">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--eos-text)]">
                {dict.notifications.title}
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] text-red-500">
                    {unreadCount} {dict.notifications.new}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
                aria-label={dict.notifications.close}
              >
                <X className="size-4" />
              </button>
            </div>

            <div
              data-lenis-prevent
              className="max-h-[min(440px,calc(100svh-10rem))] overflow-y-auto overscroll-contain bg-[var(--eos-bg-elevated)] [-webkit-overflow-scrolling:touch]"
            >
              {groupedNotifications.length === 0 ? (
                <div className="px-8 py-10 text-center text-xs font-medium text-[var(--eos-muted)]">
                  {dict.notifications.empty}
                </div>
              ) : (
                <div className="flex flex-col">
                  {groupedNotifications.map((notification) => {
                    const style = getIconAndColor(notification);
                    const Icon = style.icon;
                    const date = notification.createdAt ? new Date(notification.createdAt) : null;

                    return (
                      <button
                        type="button"
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`group relative w-full border-b border-[var(--eos-border)] p-5 text-left transition-colors hover:bg-[var(--eos-input)] ${
                          !notification.isRead ? "bg-[var(--eos-accent-soft)]" : ""
                        }`}
                      >
                        {!notification.isRead && (
                          <span className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--eos-accent)] shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                        )}
                        <div className="flex gap-4">
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.color}`}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`mb-1 line-clamp-1 text-sm font-bold ${notification.isRead ? "text-[var(--eos-muted)]" : "text-[var(--eos-text)]"}`}>
                              {notification.title}
                            </h4>
                            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--eos-muted)]">
                              {notification.message}
                            </p>
                            {(notification.count || 0) > 1 && (
                              <span className="mt-2 inline-flex rounded-full border border-[var(--eos-accent)]/25 bg-[var(--eos-accent-soft)] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--eos-accent)]">
                                {notification.count} {dict.notifications.messages}
                              </span>
                            )}
                            {date && (
                              <span className="mt-2 block text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                                {date.toLocaleDateString(locale === "pl" ? "pl-PL" : "en-US")} ·{" "}
                                {date.toLocaleTimeString(locale === "pl" ? "pl-PL" : "en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="mt-3 size-4 shrink-0 text-[var(--eos-subtle)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--eos-muted)]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--eos-border)] bg-[var(--eos-surface)] p-3 text-center">
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
              >
                {dict.notifications.markAllRead}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
