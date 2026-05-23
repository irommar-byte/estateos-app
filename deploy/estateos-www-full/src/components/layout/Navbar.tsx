"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Crown,
  Home,
  LogIn,
  LogOut,
  Menu,
  Shield,
  User,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import NotificationCenter from "@/components/NotificationCenter";
import ReviewPrompt from "@/components/ReviewPrompt";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";
import PremiumModeToggle from "@/components/ui/PremiumModeToggle";
import { useLocale } from "@/contexts/LocaleContext";
import { useUserMode } from "@/contexts/UserModeContext";

type CurrentUser = {
  id?: string | number;
  role?: string;
  plan?: string;
  user?: { id?: string | number };
};

export default function Navbar() {
  const { dict } = useLocale();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { initModeFromUser } = useUserMode();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/user/profile", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as CurrentUser;
        if (cancelled) return;

        if (res.ok && (data?.id || data?.user?.id)) {
          setUser(data);
          initModeFromUser(data);
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, initModeFromUser]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore logout network failures */
    }

    const savedTheme = localStorage.getItem("estateos_theme");
    const savedLocale = document.cookie
      .split(";")
      .find((part) => part.trim().startsWith("estateos_lang="));

    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((cookie) => {
      document.cookie = cookie
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });

    if (savedTheme) localStorage.setItem("estateos_theme", savedTheme);
    if (savedLocale) {
      document.cookie = `${savedLocale.trim()};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    }

    window.location.replace("/login");
  };

  const handleNavClick = (path: string, isMap = false) => {
    if (isMap) {
      if (pathname === "/") {
        document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push("/#map");
      }
    } else {
      router.push(path);
    }
    setIsOpen(false);
  };

  const managePath = user?.role === "ADMIN" ? "/centrala" : "/moje-konto";
  const manageLabel = user?.role === "ADMIN" ? dict.nav.manageCentral : dict.nav.manage;

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-[var(--eos-border)] bg-[var(--eos-glass)] font-sans text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl [padding-top:env(safe-area-inset-top)]">
      <div
        className="relative z-[100] mx-auto grid h-20 max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:px-6"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          className="group relative z-20 flex min-w-0 items-center gap-3 rounded-full px-1 text-left"
          aria-label={dict.nav.home}
        >
          <span className="flex size-9 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] text-xs font-black text-[var(--eos-accent)] shadow-[var(--eos-shadow-soft)]">
            EOS
          </span>
          <span className="hidden text-xl font-black uppercase italic tracking-tighter sm:block">
            <span className="text-[var(--eos-accent)]">E</span>state
            <span className="text-[var(--eos-accent)]">OS</span>
            <sup className="ml-0.5 text-[0.48em] not-italic text-[var(--eos-muted)]">TM</sup>
          </span>
        </button>

        <div className="hidden min-w-0 items-center justify-center gap-1 xl:flex 2xl:gap-2">
          <button type="button" onClick={() => handleNavClick("/", true)} className="eos-nav-link">
            {dict.nav.discoverMap}
          </button>
          <button type="button" onClick={() => handleNavClick("/oferty")} className="eos-nav-link">
            {dict.nav.market}
          </button>
          <button type="button" onClick={() => handleNavClick("/cennik")} className="eos-nav-link text-amber-500">
            {dict.nav.elite}
          </button>
        </div>

        {user && (
          <div className={`absolute left-1/2 hidden -translate-x-1/2 2xl:block ${isOpen ? "opacity-0" : ""}`}>
            <PremiumModeToggle currentUser={user} />
          </div>
        )}

        <div className="hidden min-w-0 items-center justify-end gap-2 lg:flex 2xl:gap-3">
          <ThemeSwitcher compact />
          <LanguageSwitcher />
          {user && <NotificationCenter />}

          {user ? (
            <div className="ml-1 flex items-center gap-2">
              <button type="button" onClick={() => router.push("/moje-konto")} className="eos-nav-link">
                {dict.nav.profile}
              </button>
              <button
                type="button"
                onClick={() => router.push(managePath)}
                className="rounded-full border border-[var(--eos-accent)]/30 bg-[var(--eos-accent-soft)] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-accent)] shadow-[0_12px_30px_rgba(16,185,129,0.1)] transition-all hover:bg-[var(--eos-accent)] hover:text-black"
              >
                {manageLabel}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full p-2 text-[var(--eos-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                aria-label={dict.nav.logout}
              >
                <LogOut className="size-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-text)] transition-all hover:border-[var(--eos-accent)]/40 hover:text-[var(--eos-accent)]"
            >
              {dict.nav.login}
              <LogIn className="size-4" />
            </button>
          )}
        </div>

        <div className="relative z-40 flex min-w-0 items-center justify-end gap-2 lg:hidden">
          <ThemeSwitcher compact className="hidden md:flex" />
          <LanguageSwitcher className="hidden sm:flex" />
          {user && <NotificationCenter />}
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2.5 text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-colors hover:text-[var(--eos-accent)]"
            aria-label={isOpen ? dict.nav.menuClose : dict.nav.menuOpen}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              key="mobile-nav-backdrop"
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+5rem)] z-30 bg-black/45 backdrop-blur-sm lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              key="mobile-nav-panel"
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-40 overflow-hidden border-b border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-strong)] lg:hidden"
            >
              <div className="space-y-6 p-5 pb-8">
                <div className="flex items-center justify-between gap-3 sm:hidden">
                  <ThemeSwitcher compact />
                  <LanguageSwitcher />
                </div>

                {user && (
                  <div className="flex justify-center rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3 xl:hidden">
                    <PremiumModeToggle currentUser={user} />
                  </div>
                )}

                <div className="grid gap-2">
                  <MobileNavButton icon={Home} label={dict.nav.discoverMap} onClick={() => handleNavClick("/", true)} />
                  <MobileNavButton icon={Building2} label={dict.nav.market} onClick={() => handleNavClick("/oferty")} />
                  <MobileNavButton icon={Crown} label={dict.nav.elite} accent="amber" onClick={() => handleNavClick("/cennik")} />
                </div>

                <div className="h-px bg-[var(--eos-border)]" />

                {user ? (
                  <div className="grid gap-2">
                    <MobileNavButton icon={User} label={dict.nav.profile} onClick={() => handleNavClick("/moje-konto")} />
                    <MobileNavButton icon={Shield} label={user.role === "ADMIN" ? dict.nav.manageCentral : dict.nav.manageAccount} onClick={() => handleNavClick(managePath)} />
                    <MobileNavButton icon={LogOut} label={dict.nav.logout} accent="red" onClick={handleLogout} />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => handleNavClick("/rejestracja")}
                      className="flex w-full items-center justify-center gap-3 rounded-3xl border border-[var(--eos-accent)]/25 bg-[var(--eos-accent-soft)] px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-[var(--eos-accent)]"
                    >
                      Załóż konto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick("/login")}
                      className="flex w-full items-center justify-center gap-3 rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-[var(--eos-text)]"
                    >
                      <LogIn className="size-5" />
                      {dict.nav.login}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ReviewPrompt />

      <style jsx>{`
        .eos-nav-link {
          border-radius: 999px;
          padding: 0.65rem 0.85rem;
          color: var(--eos-muted);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          transition: color 0.2s ease, background-color 0.2s ease;
        }
        .eos-nav-link:hover {
          background: var(--eos-input);
          color: var(--eos-text);
        }
      `}</style>
    </nav>
  );
}

function MobileNavButton({
  icon: Icon,
  label,
  onClick,
  accent = "emerald",
}: {
  icon: typeof Home;
  label: string;
  onClick: () => void;
  accent?: "emerald" | "amber" | "red";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-500"
      : accent === "red"
        ? "text-red-500"
        : "text-[var(--eos-accent)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-xs font-bold uppercase tracking-[0.13em] text-[var(--eos-text)] transition-colors hover:bg-[var(--eos-input)]"
    >
      <Icon className={`size-5 shrink-0 ${accentClass}`} aria-hidden />
      {label}
    </button>
  );
}
