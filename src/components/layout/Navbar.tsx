"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Car,
  Coins,
  Home,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Shield,
  User,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import NotificationCenter from "@/components/NotificationCenter";
import ContactMessagesNavButton from "@/components/contact/ContactMessagesNavButton";
import PublicationWalletNavButton from "@/components/wallet/PublicationWalletNavButton";
import NavbarProfileChip from "@/components/layout/NavbarProfileChip";
import PremiumModeToggle from "@/components/ui/PremiumModeToggle";
import { useLocale } from "@/contexts/LocaleContext";
import { useUserMode } from "@/contexts/UserModeContext";
import { useEcosystem, type EcosystemVertical } from "@/contexts/EcosystemContext";
import { useNavUnreadBadge } from "@/hooks/useNavUnreadBadge";

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

type SwitchDensity = "full" | "compact" | "mini";

type MobileChrome = {
  messages: boolean;
  wallet: boolean;
  bell: boolean;
};

const SWITCH_WIDTH: Record<SwitchDensity, number> = {
  full: 168,
  compact: 132,
  mini: 104,
};
/** Wallet chip shows "EOS 162" — much wider than icon-only buttons. */
const WALLET_SLOT = 92;
const ICON_SLOT = 44;
const HAMBURGER_SLOT = 46;
const SIDE_GAP = 8;

export default function Navbar() {
  const { dict, locale } = useLocale();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [switchDensity, setSwitchDensity] = useState<SwitchDensity>("full");
  const [mobileChrome, setMobileChrome] = useState<MobileChrome>({
    messages: true,
    wallet: true,
    bell: true,
  });
  const barRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { initModeFromUser } = useUserMode();
  const { vertical, isCar, requestVerticalSwitch } = useEcosystem();
  const isOfferShareLanding = pathname?.startsWith("/o/");
  const isAdmin = user?.role === "ADMIN";
  const loggedIn = Boolean(user);
  const unread = useNavUnreadBadge(loggedIn);
  const hamburgerBadge =
    unread.total > 0 ? (unread.total > 99 ? "99+" : String(unread.total)) : null;
  const messagesLabel =
    locale === "en" ? "Messages" : locale === "uk" ? "Повідомлення" : "Wiadomości";
  const notificationsLabel =
    locale === "en" ? "Notifications" : locale === "uk" ? "Сповіщення" : "Powiadomienia";
  const creditsLabel =
    locale === "en" ? "EOS credits" : locale === "uk" ? "Кредити EOS" : "Kredyty EOS";

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

  useEffect(() => {
    const bar = barRef.current;
    const left = leftRef.current;
    if (!bar || !left) return;

    const measure = () => {
      const barW = bar.clientWidth;
      const leftW = left.offsetWidth;
      if (barW >= 1024) {
        setMobileChrome({ messages: true, wallet: true, bell: true });
        setSwitchDensity("full");
        return;
      }

      const candidates: Array<{ chrome: MobileChrome; density: SwitchDensity }> = loggedIn
        ? [
            { chrome: { messages: true, wallet: true, bell: true }, density: "full" },
            { chrome: { messages: false, wallet: true, bell: true }, density: "full" },
            { chrome: { messages: false, wallet: false, bell: true }, density: "full" },
            { chrome: { messages: false, wallet: false, bell: false }, density: "full" },
            { chrome: { messages: false, wallet: false, bell: false }, density: "compact" },
            { chrome: { messages: false, wallet: false, bell: false }, density: "mini" },
          ]
        : [
            { chrome: { messages: false, wallet: false, bell: false }, density: "full" },
            { chrome: { messages: false, wallet: false, bell: false }, density: "compact" },
            { chrome: { messages: false, wallet: false, bell: false }, density: "mini" },
          ];

      let picked = candidates[candidates.length - 1]!;
      for (const candidate of candidates) {
        const rightW =
          HAMBURGER_SLOT +
          (candidate.chrome.wallet ? WALLET_SLOT : 0) +
          (candidate.chrome.messages ? ICON_SLOT : 0) +
          (candidate.chrome.bell ? ICON_SLOT : 0) +
          SIDE_GAP;
        // Center column gets whatever remains between left and right.
        const centerW = barW - leftW - rightW - SIDE_GAP * 2;
        if (centerW >= SWITCH_WIDTH[candidate.density]) {
          picked = candidate;
          break;
        }
      }
      setMobileChrome(picked.chrome);
      setSwitchDensity(picked.density);
    };

    const ro = new ResizeObserver(() => window.requestAnimationFrame(measure));
    ro.observe(bar);
    ro.observe(left);
    measure();
    return () => ro.disconnect();
  }, [loggedIn, isAdmin]);

  if (isOfferShareLanding) return null;

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

  const handleNavClick = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const switchVertical = (next: EcosystemVertical) => {
    if (next === vertical) {
      if (next === "car" && !pathname?.startsWith("/cars")) {
        requestVerticalSwitch("car", "/cars");
      } else if (next === "home" && pathname?.startsWith("/cars")) {
        requestVerticalSwitch("home", "/oferty");
      }
      return;
    }
    requestVerticalSwitch(next, next === "car" ? "/cars" : "/oferty");
  };

  const manageLabel = dict.nav.manageCentral;
  const manageLabelShort = dict.nav.manageCentralShort;
  const switchPad =
    switchDensity === "mini"
      ? "px-1.5 py-1"
      : switchDensity === "compact"
        ? "px-2 py-1.5"
        : "px-2.5 py-1.5 sm:px-3";
  const switchText =
    switchDensity === "mini"
      ? "text-[8px]"
      : switchDensity === "compact"
        ? "text-[9px]"
        : "text-[9px] sm:text-[10px]";
  const switchIcon = switchDensity === "mini" ? "size-3" : "size-3.5";
  const showCollapsedShortcuts =
    loggedIn && (!mobileChrome.messages || !mobileChrome.wallet || !mobileChrome.bell);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-[var(--eos-border)] bg-[var(--eos-glass)] font-sans text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl [padding-top:env(safe-area-inset-top)]">
      <div
        ref={barRef}
        className="relative mx-auto grid h-20 max-w-[1400px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-3 sm:gap-2 sm:px-4 md:px-6"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <div ref={leftRef} className="relative z-20 flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="group relative z-20 flex shrink-0 items-center gap-2 rounded-full px-1 text-left sm:gap-3"
            aria-label="EstateOS home"
          >
            <span
              className={`eos-nav-mark flex size-9 items-center justify-center rounded-full border bg-[var(--eos-surface)] text-[10px] font-black sm:size-11 sm:text-xs ${
                isCar ? "border-sky-400/35 text-sky-300" : "border-[var(--eos-border)]"
              }`}
            >
              EOS
            </span>
            <span className="eos-nav-wordmark hidden xl:block">
              <span className="eos-nav-wordmark-body">
                <span className={`eos-nav-wordmark-accent ${isCar ? "text-sky-300" : ""}`}>E</span>state
                <span className={`eos-nav-wordmark-accent ${isCar ? "text-sky-300" : ""}`}>OS</span>
                <sup className="eos-nav-wordmark-tm">TM</sup>
                {isCar ? (
                  <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Car</span>
                ) : (
                  <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Home</span>
                )}
              </span>
            </span>
          </button>
        </div>

        <div className="relative z-30 flex min-w-0 items-center justify-center overflow-hidden px-0.5">
          <div
            className={`flex shrink-0 items-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] shadow-[var(--eos-shadow-soft)] ${
              switchDensity === "mini" ? "p-0.5" : "p-0.5 sm:p-1"
            }`}
          >
            <button
              type="button"
              onClick={() => switchVertical("home")}
              aria-pressed={vertical === "home"}
              className={`group/home inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.1em] transition ${switchPad} ${switchText} ${
                vertical === "home"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              <Home
                className={`${switchIcon} transition duration-300 ${
                  vertical === "home"
                    ? "scale-110 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]"
                    : "opacity-70 group-hover/home:scale-105 group-hover/home:opacity-100"
                }`}
                strokeWidth={2.25}
                aria-hidden
              />
              Home
            </button>
            <button
              type="button"
              onClick={() => switchVertical("car")}
              aria-pressed={vertical === "car"}
              className={`group/car inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.1em] transition ${switchPad} ${switchText} ${
                vertical === "car"
                  ? "bg-sky-500/20 text-sky-300"
                  : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              <Car
                className={`${switchIcon} transition duration-300 ${
                  vertical === "car"
                    ? "scale-110 text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.55)]"
                    : "opacity-70 group-hover/car:scale-105 group-hover/car:opacity-100"
                }`}
                strokeWidth={2.25}
                aria-hidden
              />
              Car
            </button>
          </div>
        </div>

        <div className="relative z-20 flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
          <div className="hidden min-w-0 items-center justify-end gap-1 lg:flex lg:gap-1.5 2xl:gap-2">
            {user && (
              <>
                <div className="hidden 2xl:block">
                  <PremiumModeToggle currentUser={user} />
                </div>
                <PublicationWalletNavButton />
                <ContactMessagesNavButton />
                <NotificationCenter />
              </>
            )}

            {user ? (
              <div className="ml-0.5 flex min-w-0 items-center gap-1 2xl:gap-2">
                <NavbarProfileChip user={user} />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => router.push("/centrala")}
                    className="eos-nav-admin shrink-0 rounded-full border border-[var(--eos-accent)]/30 bg-[var(--eos-accent-soft)] px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--eos-accent)] shadow-[0_12px_30px_rgba(16,185,129,0.1)] transition-all hover:bg-[var(--eos-accent)] hover:text-black lg:px-3 2xl:px-5 2xl:py-2.5 2xl:text-[10px] 2xl:tracking-[0.18em]"
                  >
                    <span className="2xl:hidden">{manageLabelShort}</span>
                    <span className="hidden 2xl:inline">{manageLabel}</span>
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
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--eos-text)] transition-all hover:border-[var(--eos-accent)]/40 hover:text-[var(--eos-accent)] 2xl:px-5 2xl:py-2.5 2xl:text-[10px] 2xl:tracking-[0.18em]"
              >
                {dict.nav.login}
                <LogIn className="size-4" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 lg:hidden">
            {user && mobileChrome.wallet ? <PublicationWalletNavButton /> : null}
            {user && mobileChrome.messages ? <ContactMessagesNavButton /> : null}
            {user && mobileChrome.bell ? <NotificationCenter /> : null}
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="relative rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2.5 text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-colors hover:text-[var(--eos-accent)]"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              {hamburgerBadge && !isOpen ? (
                <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-[0_0_12px_rgba(239,68,68,0.55)]">
                  {hamburgerBadge}
                </span>
              ) : null}
            </button>
          </div>
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
              className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm lg:hidden"
              style={{ top: "var(--eos-nav-height)" }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              key="mobile-nav-panel"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 z-[60] overflow-y-auto border-b border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-strong)] lg:hidden"
              style={{
                top: "var(--eos-nav-height)",
                maxHeight: "calc(100dvh - var(--eos-nav-height))",
              }}
            >
              <div className="space-y-6 p-5 pb-8">
                {user && (
                  <div className="flex justify-center rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3">
                    <PremiumModeToggle currentUser={user} />
                  </div>
                )}

                <div className="grid gap-2">
                  <MobileNavButton
                    icon={Home}
                    label="EstateOS™Home"
                    onClick={() => {
                      requestVerticalSwitch("home", "/oferty");
                      setIsOpen(false);
                    }}
                    variant="primary"
                  />
                  <MobileNavButton
                    icon={Car}
                    label="EstateOS™Car"
                    onClick={() => {
                      requestVerticalSwitch("car", "/cars");
                      setIsOpen(false);
                    }}
                    variant="primary"
                  />
                </div>

                {showCollapsedShortcuts ? (
                  <>
                    <div className="h-px bg-[var(--eos-border)]" />
                    <div className="grid gap-2">
                      {!mobileChrome.messages ? (
                        <MobileNavButton
                          icon={MessageCircle}
                          label={`${messagesLabel}${
                            unread.messages > 0 ? ` (${unread.messages > 99 ? "99+" : unread.messages})` : ""
                          }`}
                          onClick={() => handleNavClick("/moje-konto/wiadomosci")}
                          variant="primary"
                        />
                      ) : null}
                      {!mobileChrome.wallet ? (
                        <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-3">
                          <span className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-[0.14em]">
                            <Coins className="size-5 text-amber-500" aria-hidden />
                            {creditsLabel}
                          </span>
                          <PublicationWalletNavButton />
                        </div>
                      ) : null}
                      {!mobileChrome.bell ? (
                        <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-3">
                          <span className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-[0.14em]">
                            <Bell className="size-5 text-[var(--eos-accent)]" aria-hidden />
                            {notificationsLabel}
                            {unread.notifications > 0 ? (
                              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                                {unread.notifications > 99 ? "99+" : unread.notifications}
                              </span>
                            ) : null}
                          </span>
                          <NotificationCenter />
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

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
