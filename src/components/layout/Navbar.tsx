"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
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
import ContactMessagesNavButton from "@/components/contact/ContactMessagesNavButton";
import PublicationWalletNavButton from "@/components/wallet/PublicationWalletNavButton";
import NavbarProfileChip from "@/components/layout/NavbarProfileChip";
import PresentationFlowOrchestrator from "@/components/presentation/PresentationFlowOrchestrator";
import PremiumModeToggle from "@/components/ui/PremiumModeToggle";
import { useLocale } from "@/contexts/LocaleContext";
import { useUserMode } from "@/contexts/UserModeContext";

type CurrentUser = {
  id?: string | number;
  role?: string;
  plan?: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: {
    id?: string | number;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
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
      router.push("/odkryj-mape");
    } else {
      router.push(path);
    }
    setIsOpen(false);
  };

  const isAdmin = user?.role === "ADMIN";
  const manageLabel = dict.nav.manageCentral;

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
          className="group relative z-20 flex shrink-0 items-center gap-3 rounded-full px-1 text-left"
          aria-label="EstateOS home"
        >
          <span className="eos-nav-mark flex size-10 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] text-[11px] font-black sm:size-11 sm:text-xs">
            EOS
          </span>
          <span className="eos-nav-wordmark hidden sm:block">
            <span className="eos-nav-wordmark-body">
              <span className="eos-nav-wordmark-accent">E</span>state
              <span className="eos-nav-wordmark-accent">OS</span>
              <sup className="eos-nav-wordmark-tm">TM</sup>
            </span>
          </span>
        </button>

        <div className="hidden min-w-0 flex-1 items-center justify-center overflow-hidden lg:flex">
          <div className="eos-nav-primary-group flex min-w-0 items-center gap-1 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1 shadow-[var(--eos-shadow-soft)] xl:gap-1.5 xl:p-1.5">
            <button
              type="button"
              onClick={() => handleNavClick("/odkryj-mape", true)}
              className="eos-nav-link-primary shrink min-w-0"
            >
              {dict.nav.discoverMap}
            </button>
            <button type="button" onClick={() => handleNavClick("/oferty")} className="eos-nav-link-primary shrink min-w-0">
              {dict.nav.market}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick("/agencje")}
              className={`eos-nav-link-primary shrink min-w-0 ${pathname === "/agencje" ? "eos-nav-link-primary--active" : ""}`}
            >
              {dict.nav.agencyCatalog}
            </button>
          </div>
        </div>

        {user && (
          <div className={`absolute left-1/2 hidden -translate-x-1/2 2xl:block ${isOpen ? "opacity-0" : ""}`}>
            <PremiumModeToggle currentUser={user} />
          </div>
        )}

        <div className="hidden min-w-0 items-center justify-end gap-1.5 lg:flex xl:gap-2 2xl:gap-3">
          {user && (
            <>
              <PublicationWalletNavButton />
              <ContactMessagesNavButton />
              <NotificationCenter />
            </>
          )}

          {user ? (
            <div className="ml-0.5 flex min-w-0 items-center gap-1 lg:gap-1.5 xl:gap-2">
              <NavbarProfileChip user={user} />
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => router.push("/centrala")}
                  className="eos-nav-admin shrink rounded-full border border-[var(--eos-accent)]/30 bg-[var(--eos-accent-soft)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--eos-accent)] shadow-[0_12px_30px_rgba(16,185,129,0.1)] transition-all hover:bg-[var(--eos-accent)] hover:text-black xl:px-5 xl:py-2.5 xl:text-[10px] xl:tracking-[0.18em]"
                >
                  {manageLabel}
                </button>
              )}
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
              className="inline-flex shrink items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--eos-text)] transition-all hover:border-[var(--eos-accent)]/40 hover:text-[var(--eos-accent)] xl:px-5 xl:py-2.5 xl:text-[10px] xl:tracking-[0.18em]"
            >
              {dict.nav.login}
              <LogIn className="size-4" />
            </button>
          )}
        </div>

        <div className="relative z-40 flex min-w-0 items-center justify-end gap-2 lg:hidden">
          {user && (
            <>
              <PublicationWalletNavButton />
              <ContactMessagesNavButton />
              <NotificationCenter />
            </>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2.5 text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-colors hover:text-[var(--eos-accent)]"
            aria-label={isOpen ? "Close menu" : "Open menu"}
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
                {user && (
                  <div className="flex justify-center rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3 xl:hidden">
                    <PremiumModeToggle currentUser={user} />
                  </div>
                )}

                <div className="grid gap-2">
                  <MobileNavButton
                    icon={Home}
                    label={dict.nav.discoverMap}
                    onClick={() => handleNavClick("/odkryj-mape", true)}
                    variant="primary"
                  />
                  <MobileNavButton icon={Building2} label={dict.nav.market} onClick={() => handleNavClick("/oferty")} variant="primary" />
                  <MobileNavButton icon={Building2} label={dict.nav.agencyCatalog} onClick={() => handleNavClick("/agencje")} variant="primary" />
                </div>

                <div className="h-px bg-[var(--eos-border)]" />

                {user ? (
                  <div className="grid gap-2">
                    <MobileNavButton icon={User} label={dict.nav.profile} onClick={() => handleNavClick("/moje-konto")} />
                    {isAdmin && (
                      <MobileNavButton icon={Shield} label={dict.nav.manageCentral} onClick={() => handleNavClick("/centrala")} />
                    )}
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

      <PresentationFlowOrchestrator />

      <style jsx>{`
        .eos-nav-wordmark {
          overflow: visible;
          padding-right: 0.12rem;
        }
        .eos-nav-mark {
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.1) 0%, rgba(52, 211, 153, 0.16) 100%);
          color: #5eead4;
          letter-spacing: 0.06em;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.16),
            inset 0 -1px 0 rgba(0, 0, 0, 0.22),
            0 2px 10px rgba(0, 0, 0, 0.28);
          transition: transform 0.25s ease, box-shadow 0.25s ease, color 0.25s ease;
        }
        :global(.group:hover) .eos-nav-mark {
          color: #6ee7b7;
          transform: translateY(-1px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            inset 0 -1px 0 rgba(0, 0, 0, 0.18),
            0 4px 14px rgba(0, 0, 0, 0.32);
        }
        .eos-nav-wordmark-body {
          display: inline-block;
          overflow: visible;
          padding-right: 0.08em;
          font-size: clamp(1.14rem, 1.55vw, 1.48rem);
          font-weight: 800;
          font-style: normal;
          letter-spacing: 0.04em;
          line-height: 1.2;
          text-transform: uppercase;
          color: var(--eos-text);
          -webkit-font-smoothing: antialiased;
          text-shadow:
            0 1px 0 rgba(255, 255, 255, 0.22),
            0 2px 0 rgba(0, 0, 0, 0.08),
            0 3px 6px rgba(0, 0, 0, 0.12);
          transition: color 0.25s ease, text-shadow 0.25s ease;
        }
        :global(.group:hover) .eos-nav-wordmark-body {
          text-shadow:
            0 1px 0 rgba(255, 255, 255, 0.28),
            0 2px 0 rgba(0, 0, 0, 0.06),
            0 4px 8px rgba(0, 0, 0, 0.16);
        }
        .eos-nav-wordmark-accent {
          display: inline-block;
          padding-right: 0.05em;
          background: linear-gradient(180deg, #6ee7b7 0%, #34d399 42%, #10b981 72%, #059669 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        :global(.group:hover) .eos-nav-wordmark-accent {
          background: linear-gradient(180deg, #7ef0c4 0%, #3ddda5 40%, #12c98e 70%, #06a676 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .eos-nav-wordmark-tm {
          margin-left: 0.15em;
          font-size: 0.38em;
          font-weight: 600;
          letter-spacing: 0.04em;
          vertical-align: super;
          color: var(--eos-muted);
          text-shadow: none;
        }
        .eos-nav-primary-group {
          box-shadow:
            0 10px 28px rgba(0, 0, 0, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .eos-nav-link-primary {
          border-radius: 999px;
          padding: 0.62rem 0.85rem;
          color: var(--eos-text);
          font-size: clamp(10px, 0.78vw, 13px);
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1.15;
          text-transform: uppercase;
          transition:
            color 0.2s ease,
            background-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
          white-space: nowrap;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 100%);
        }
        @media (min-width: 1280px) {
          .eos-nav-link-primary {
            padding: 0.72rem 1.05rem;
            font-size: 12px;
            letter-spacing: 0.14em;
          }
        }
        @media (min-width: 1536px) {
          .eos-nav-link-primary {
            padding: 0.78rem 1.2rem;
            font-size: 13px;
          }
        }
        .eos-nav-link-primary:hover {
          background: var(--eos-accent-soft);
          color: var(--eos-accent);
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.14);
          transform: translateY(-1px);
        }
        .eos-nav-link-primary--active {
          background: var(--eos-accent-soft);
          color: var(--eos-accent);
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.14);
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
  variant = "default",
}: {
  icon: typeof Home;
  label: string;
  onClick: () => void;
  accent?: "emerald" | "amber" | "red";
  variant?: "default" | "primary";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-500"
      : accent === "red"
        ? "text-red-500"
        : "text-[var(--eos-accent)]";

  const primaryClass =
    variant === "primary"
      ? "rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-4 text-sm font-black tracking-[0.14em] shadow-[var(--eos-shadow-soft)]"
      : "rounded-2xl px-4 py-3.5 text-xs font-bold tracking-[0.13em]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 text-left uppercase text-[var(--eos-text)] transition-colors hover:bg-[var(--eos-input)] ${primaryClass}`}
    >
      <Icon className={`size-5 shrink-0 ${accentClass}`} aria-hidden />
      {label}
    </button>
  );
}
