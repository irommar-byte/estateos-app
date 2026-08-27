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
import DiscoveryNavWhisper from "@/components/discovery/DiscoveryNavWhisper";
import EcosystemLuxurySwitch, {
  type LuxSwitchDensity,
} from "@/components/layout/EcosystemLuxurySwitch";
import {
  clientPortalHref,
  readClientPortalToken,
} from "@/lib/crm/portalSession";
import { useLocale } from "@/contexts/LocaleContext";
import { useUserMode } from "@/contexts/UserModeContext";
import { useEcosystem, type EcosystemVertical } from "@/contexts/EcosystemContext";
import { useNavUnreadBadge } from "@/hooks/useNavUnreadBadge";

type CurrentUser = {
  id?: string | number;
  role?: string;
  plan?: string;
  planType?: string;
  isPro?: boolean;
  officePro?: boolean;
  hasMarketPro?: boolean;
  image?: string | null;
  avatar?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: {
    id?: string | number;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string;
    planType?: string;
    isPro?: boolean;
    image?: string | null;
  };
};

type SwitchDensity = LuxSwitchDensity;

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
  const [portalToken, setPortalToken] = useState<string | null>(null);
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
  const { navHighlight, requestVerticalSwitch } = useEcosystem();
  const highlightHome = navHighlight === "home";
  const highlightCar = navHighlight === "car";
  const brandIsCar = highlightCar;

  const isOfferShareLanding = pathname?.startsWith("/o/");
  const isDeskApp = pathname?.startsWith("/crm");
  const isAdmin = user?.role === "ADMIN";
  const loggedIn = Boolean(user);
  const unread = useNavUnreadBadge(loggedIn);
  const messagesLabel =
    locale === "en" ? "Messages" : locale === "uk" ? "Повідомлення" : "Wiadomości";
  const notificationsLabel =
    locale === "en" ? "Notifications" : locale === "uk" ? "Сповіщення" : "Powiadomienia";
  const creditsLabel =
    locale === "en" ? "EOS credits" : locale === "uk" ? "Кредити EOS" : "Kredyty EOS";

  useEffect(() => {
    setIsOpen(false);
    setPortalToken(readClientPortalToken());
  }, [pathname]);

  useEffect(() => {
    setPortalToken(readClientPortalToken());
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    const ping = () => {
      void fetch("/api/presence/ping", { method: "POST", credentials: "include" }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 3 * 60 * 1000);
    const onFocus = () => {
      if (!cancelled) ping();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loggedIn]);

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
  if (isDeskApp) return null;

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
    const href = next === "car" ? "/cars" : "/oferty";
    const alreadyOnTarget =
      next === "car" ? Boolean(pathname?.startsWith("/cars")) : Boolean(pathname?.startsWith("/oferty"));
    // Homepage keeps both pills idle until click; click always opens the catalog.
    if (navHighlight === next && alreadyOnTarget) return;
    requestVerticalSwitch(next, href);
  };

  const manageLabel = dict.nav.manageCentral;
  const manageLabelShort = dict.nav.manageCentralShort;
  const showCollapsedShortcuts =
    loggedIn && (!mobileChrome.messages || !mobileChrome.wallet || !mobileChrome.bell);
  const hamburgerBadge =
    showCollapsedShortcuts && unread.total > 0
      ? unread.total > 99
        ? "99+"
        : String(unread.total)
      : null;

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
                brandIsCar ? "border-sky-400/35 text-sky-300" : "border-[var(--eos-border)]"
              }`}
            >
              EOS
            </span>
            <span className="eos-nav-wordmark hidden xl:block">
              <span className="eos-nav-wordmark-body">
                <span className={`eos-nav-wordmark-accent ${brandIsCar ? "text-sky-300" : highlightHome ? "text-emerald-500" : ""}`}>E</span>state
                <span className={`eos-nav-wordmark-accent ${brandIsCar ? "text-sky-300" : highlightHome ? "text-emerald-500" : ""}`}>OS</span>
                <sup className="eos-nav-wordmark-tm">TM</sup>
                {brandIsCar ? (
                  <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Car</span>
                ) : highlightHome ? (
                  <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Home</span>
                ) : null}
              </span>
            </span>
          </button>
        </div>

        <div className="relative z-10 flex min-w-0 items-center justify-center overflow-visible px-0.5">
          <EcosystemLuxurySwitch
            density={switchDensity}
            highlightHome={highlightHome}
            highlightCar={highlightCar}
            onHome={() => switchVertical("home")}
            onCar={() => switchVertical("car")}
          />
        </div>

        <div className="relative z-40 flex min-w-0 items-center justify-end gap-1 overflow-visible pt-1 sm:gap-1.5">
          <div className="hidden min-w-0 max-w-full items-center justify-end gap-1 lg:flex lg:gap-1.5 xl:gap-2">
            {user && (
              <>
                <PublicationWalletNavButton />
                <ContactMessagesNavButton />
                <NotificationCenter />
              </>
            )}

            {user ? (
              <div className="ml-0.5 flex min-w-0 items-center gap-1.5 xl:gap-2">
                <DiscoveryNavWhisper variant="nav" />
                <NavbarProfileChip user={user.user ? { ...user, ...user.user } : user} />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => router.push("/centrala")}
                    className="eos-nav-admin shrink-0 rounded-full px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.1em] transition-all xl:px-3.5 xl:text-[10px] xl:tracking-[0.14em]"
                  >
                    {manageLabelShort}
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
              <div className="ml-0.5 flex shrink-0 items-center gap-1.5">
                {portalToken ? (
                  <button
                    type="button"
                    onClick={() => router.push(clientPortalHref(portalToken))}
                    className="eos-lux-btn eos-lux-btn--primary shrink-0 !gap-2 px-3 py-2 text-[9px] tracking-[0.12em] 2xl:px-5 2xl:py-2.5 2xl:text-[10px] 2xl:tracking-[0.18em]"
                  >
                    {dict.nav.clientPanel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="eos-lux-btn eos-lux-btn--platinum shrink-0 !gap-2 px-3 py-2 text-[9px] tracking-[0.12em] 2xl:px-5 2xl:py-2.5 2xl:text-[10px] 2xl:tracking-[0.18em]"
                >
                  {dict.nav.login}
                  <LogIn className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 lg:hidden">
            {user && mobileChrome.wallet ? <PublicationWalletNavButton /> : null}
            {user && mobileChrome.messages ? <ContactMessagesNavButton /> : null}
            {user && mobileChrome.bell ? <NotificationCenter /> : null}
            {user ? (
              <NavbarProfileChip user={user.user ? { ...user, ...user.user } : user} />
            ) : null}
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="eos-lux-btn eos-lux-btn--platinum eos-nav-badge-host relative !min-h-0 overflow-visible rounded-2xl !px-2.5 !py-2.5 text-[var(--eos-text)]"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              {hamburgerBadge && !isOpen ? (
                <span className="eos-nav-unread">{hamburgerBadge}</span>
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
              transition={{ duration: 0.28 }}
              className="fixed inset-0 z-[55] bg-[rgba(20,18,14,0.45)] backdrop-blur-md lg:hidden"
              style={{ top: "var(--eos-nav-height)" }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              key="mobile-nav-panel"
              initial={{ opacity: 0, y: -28, clipPath: "inset(0 0 100% 0)" }}
              animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
              exit={{ opacity: 0, y: -18, clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
              className="eos-lux-drawer fixed inset-x-0 z-[60] overflow-y-auto lg:hidden"
              style={{
                top: "var(--eos-nav-height)",
                maxHeight: "calc(100dvh - var(--eos-nav-height))",
              }}
            >
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#c4a35a]/70 to-transparent" />
              <div className="space-y-4 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:space-y-5 sm:p-5 sm:pb-8">
                <p className="px-1 text-[9px] font-black uppercase tracking-[0.28em] text-[#7a6230]/90">
                  EstateOS™ Ecosystem
                </p>
                <div className="grid gap-2.5">
                  <MobileNavButton
                    icon={Home}
                    label="EstateOS™ Home"
                    delay={0.06}
                    onClick={() => {
                      requestVerticalSwitch("home", "/oferty");
                      setIsOpen(false);
                    }}
                    variant="primary"
                  />
                  <MobileNavButton
                    icon={Car}
                    label="EstateOS™ Car"
                    delay={0.12}
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
                          delay={0.14}
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
                    <DiscoveryNavWhisper variant="drawer" />
                    <MobileNavButton delay={0.16} icon={User} label={dict.nav.profile} onClick={() => handleNavClick("/moje-konto")} />
                    {isAdmin && (
                      <MobileNavButton delay={0.2} icon={Shield} label={dict.nav.manageCentral} onClick={() => handleNavClick("/centrala")} />
                    )}
                    <MobileNavButton delay={0.24} icon={LogOut} label={dict.nav.logout} accent="red" onClick={handleLogout} />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {portalToken ? (
                      <button
                        type="button"
                        onClick={() => handleNavClick(clientPortalHref(portalToken))}
                        className="eos-lux-btn eos-lux-btn--gold w-full px-5 py-4 text-xs tracking-[0.2em]"
                      >
                        {dict.nav.clientPanel}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleNavClick("/rejestracja")}
                      className="eos-lux-btn eos-lux-btn--primary w-full px-5 py-4 text-xs tracking-[0.2em]"
                    >
                      Załóż konto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick("/login")}
                      className="eos-lux-btn eos-lux-btn--platinum w-full px-5 py-4 text-xs tracking-[0.2em]"
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
  delay = 0,
}: {
  icon: typeof Home;
  label: string;
  onClick: () => void;
  accent?: "emerald" | "amber" | "red";
  variant?: "default" | "primary";
  delay?: number;
}) {
  const accentClass =
    accent === "amber"
      ? "text-[#9a7b3c]"
      : accent === "red"
        ? "text-red-500"
        : "text-emerald-600";

  const sizeClass =
    variant === "primary"
      ? "px-5 py-4 text-sm font-black tracking-[0.14em]"
      : "px-4 py-3.5 text-xs font-bold tracking-[0.13em]";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.985 }}
      className={`eos-lux-drawer-item flex w-full items-center gap-4 text-left uppercase text-[var(--eos-text)] ${sizeClass}`}
    >
      <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(196,163,90,0.28)] bg-[rgba(196,163,90,0.1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <Icon className={`size-5 ${accentClass}`} aria-hidden />
      </span>
      <span className="relative z-10 flex-1">{label}</span>
    </motion.button>
  );
}
