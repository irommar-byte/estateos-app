"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Diamond,
  Flame,
  Info,
  MessageCircle,
  ShieldAlert,
  Star,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";
import { showWebNotification } from "@/lib/webNotifications";

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
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsBootstrappedRef = useRef(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const list: NotificationItem[] = Array.isArray(data) ? data : [];
        setNotifications(list);

        if (!notificationsBootstrappedRef.current) {
          for (const notification of list) {
            shownNotificationIdsRef.current.add(String(notification.id));
          }
          notificationsBootstrappedRef.current = true;
          return;
        }

        for (const notification of list) {
          if (notification.isRead) continue;
          const id = String(notification.id);
          if (shownNotificationIdsRef.current.has(id)) continue;
          shownNotificationIdsRef.current.add(id);
          showWebNotification(notification.title || dict.notifications.title, {
            body: notification.message,
            tag: notification.groupKey ? String(notification.groupKey) : id,
            onClickPath: notification.link || "/moje-konto/crm",
          });
        }
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
    setMounted(true);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void fetchNotifications();
    };
    void tick();
    const interval = window.setInterval(tick, 30_000);
    window.addEventListener("refreshNotifications", fetchNotifications);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("refreshNotifications", fetchNotifications);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [dict.notifications.title]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
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

    if (title.includes("Nowe zgłoszenie agenta") || title.includes("zgłoszenie agenta")) {
      return { icon: Users, color: "text-amber-500", bg: "bg-amber-500/10" };
    }
    if (title.includes("Deal Room") || title.includes("Wiadomość") || type === "DEAL_UPDATE") {
      return { icon: Briefcase, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    }
    if (title.includes("Contact") || type === "MESSAGE") {
      return { icon: MessageCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" };
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

  const pl = locale === "pl";
  const T = {
    all: pl ? "Wszystkie" : locale === "uk" ? "Усі" : "All",
    unread: pl ? "Nieprzeczytane" : locale === "uk" ? "Непрочитані" : "Unread",
    today: pl ? "Dziś" : locale === "uk" ? "Сьогодні" : "Today",
    yesterday: pl ? "Wczoraj" : locale === "uk" ? "Вчора" : "Yesterday",
    earlier: pl ? "Wcześniej" : locale === "uk" ? "Раніше" : "Earlier",
    allRead: pl ? "Wszystko przeczytane" : locale === "uk" ? "Усе прочитано" : "You're all caught up",
    allReadHint: pl ? "Nowe powiadomienia pojawią się tutaj." : locale === "uk" ? "Нові сповіщення з’являться тут." : "New notifications will appear here.",
  };
  const timeAgo = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Math.max(0, Date.now() - d.getTime()) / 1000;
    if (diff < 60) return pl ? "teraz" : "now";
    if (diff < 3600) return pl ? `${Math.floor(diff / 60)} min temu` : `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return pl ? `${Math.floor(diff / 3600)} godz. temu` : `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString(pl ? "pl-PL" : "en-GB", { day: "numeric", month: "short" }) +
      " · " + d.toLocaleTimeString(pl ? "pl-PL" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  };
  const dayBucket = (iso?: string) => {
    if (!iso) return T.earlier;
    const d = new Date(iso);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (d >= start) return T.today;
    if (d.getTime() >= start.getTime() - 86_400_000) return T.yesterday;
    return T.earlier;
  };
  const visible = groupedNotifications.filter((n) => (filter === "unread" ? !n.isRead : true));
  const sections: Array<{ label: string; items: NotificationItem[] }> = [];
  for (const n of visible) {
    const label = dayBucket(n.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(n);
    else sections.push({ label, items: [n] });
  }

  const panel =
    isOpen && mounted
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="theme-aware-dashboard fixed inset-x-3 bottom-[calc(var(--eos-dock-offset,5.5rem)+env(safe-area-inset-bottom,0px))] eos-z-dropdown flex max-h-[min(72dvh,560px)] w-auto flex-col overflow-hidden rounded-[1.6rem] border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset] sm:inset-x-auto sm:bottom-auto sm:left-auto sm:right-4 sm:top-[calc(env(safe-area-inset-top)+4.75rem)] sm:max-h-[min(560px,calc(100svh-7rem))] sm:w-[420px]"
            >
              <div className="shrink-0 px-5 pb-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[19px] font-bold tracking-tight text-[var(--eos-text)]">{dict.notifications.title}</h3>
                    <p className="mt-0.5 text-xs text-[var(--eos-muted)]">
                      {unreadCount > 0 ? `${unreadCount} ${dict.notifications.new}` : T.allRead}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        {dict.notifications.markAllRead}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="flex size-8 items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
                      aria-label={dict.notifications.close}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 rounded-xl bg-[var(--eos-input)] p-1 text-xs font-semibold">
                  {(["all", "unread"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`relative rounded-lg py-1.5 transition-colors ${
                        filter === key ? "text-[var(--eos-text)]" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                      }`}
                    >
                      {filter === key ? (
                        <motion.span
                          layoutId="eos-notif-tab"
                          className="absolute inset-0 rounded-lg bg-[var(--eos-card)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      ) : null}
                      <span className="relative">
                        {key === "all" ? T.all : T.unread}
                        {key === "unread" && unreadCount > 0 ? ` · ${unreadCount}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                data-lenis-prevent
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 [-webkit-overflow-scrolling:touch]"
              >
                {visible.length === 0 ? (
                  <div className="flex flex-col items-center px-8 py-12 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                      <CheckCircle className="size-6" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[var(--eos-text)]">{T.allRead}</p>
                    <p className="mt-1 text-xs text-[var(--eos-muted)]">{T.allReadHint}</p>
                  </div>
                ) : (
                  sections.map((section) => (
                    <div key={section.label} className="pb-1">
                      <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--eos-subtle)]">
                        {section.label}
                      </p>
                      {section.items.map((notification, index) => {
                        const style = getIconAndColor(notification);
                        const Icon = style.icon;
                        return (
                          <motion.button
                            type="button"
                            key={notification.groupKey || String(notification.id)}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index, 8) * 0.025, duration: 0.22 }}
                            onClick={() => handleNotificationClick(notification)}
                            className={`group relative flex w-full gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-[var(--eos-input)] ${
                              !notification.isRead ? "bg-emerald-500/[0.06]" : ""
                            }`}
                          >
                            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.color}`}>
                              <Icon className="size-[18px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <h4
                                  className={`line-clamp-1 text-[13.5px] ${
                                    notification.isRead ? "font-medium text-[var(--eos-muted)]" : "font-semibold text-[var(--eos-text)]"
                                  }`}
                                >
                                  {notification.title}
                                </h4>
                                <span className="shrink-0 text-[11px] text-[var(--eos-subtle)]">{timeAgo(notification.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--eos-muted)]">{notification.message}</p>
                              {(notification.count || 0) > 1 && (
                                <span className="mt-1.5 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  {notification.count} {dict.notifications.messages}
                                </span>
                              )}
                            </div>
                            {!notification.isRead ? (
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
                            ) : (
                              <ChevronRight className="mt-1 size-4 shrink-0 text-[var(--eos-subtle)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div className="relative z-50 shrink-0 overflow-visible" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={dict.notifications.label}
        aria-expanded={isOpen}
        className="relative overflow-visible rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2.5 text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-colors hover:border-[var(--eos-accent)]/30 hover:text-[var(--eos-accent)]"
      >
        <Bell className={`size-5 ${unreadCount > 0 ? "animate-[wiggle_3s_ease-in-out_infinite]" : ""}`} />
        {unreadCount > 0 && (
          <span className="eos-nav-unread">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
