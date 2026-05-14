"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Crown,
  Home,
  LogIn,
  LogOut,
  Menu,
  PlusCircle,
  Shield,
  User,
  X,
} from "lucide-react";
import clsx from "clsx";
import NotificationCenter from "@/components/NotificationCenter";
import ReviewPrompt from "@/components/ReviewPrompt";
import PremiumModeToggle from "@/components/ui/PremiumModeToggle";
import { useUserMode } from "@/contexts/UserModeContext";

const DESKTOP_NAV = [
  { href: "/#map-section", label: "Mapa" },
  { href: "/oferty", label: "Oferty" },
  { href: "/cennik", label: "Cennik" },
  { href: "/eksperci", label: "Eksperci" },
  { href: "/dodaj-oferte", label: "Dodaj" },
] as const;

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { initModeFromUser } = useUserMode();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setUser(data);
          initModeFromUser(data);
        }
      })
      .catch(() => setUser(null));
  }, [initModeFromUser]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }

    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    window.location.replace("/login");
  };

  const handleNavClick = (path: string, isMap = false) => {
    if (isMap) {
      if (pathname === "/")
        document.getElementById("map-section")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      else router.push("/#map-section");
    } else {
      router.push(path);
    }
    setIsOpen(false);
  };

  const navLinkClass = (href: string) => {
    const base = href.split("#")[0];
    const isHashMap = href.includes("map-section");
    const active =
      (!isHashMap && (pathname === base || (base !== "/" && pathname.startsWith(base)))) ||
      (isHashMap && pathname === "/");
    return clsx(
      "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
      active ? "text-white" : "text-white/50 hover:text-white/90",
    );
  };

  const motionMenu = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, height: 0, y: -12 }, animate: { opacity: 1, height: "auto", y: 0 }, exit: { opacity: 0, height: 0, y: -12 } };

  return (
    <nav
      aria-label="Główna nawigacja"
      className={clsx(
        "fixed inset-x-0 top-0 z-50 border-b font-sans pt-[env(safe-area-inset-top,0px)] backdrop-blur-2xl transition-colors duration-300",
        isScrolled ? "border-white/10 bg-black/75" : "border-white/5 bg-black/60",
      )}
    >
      <div className="eos-page-x flex h-24 items-start justify-between sm:h-20 sm:items-center sm:pt-0">
        <Link
          href="/"
          className="group relative z-20 hidden shrink-0 sm:inline-flex"
          aria-label="EstateOS — strona główna"
        >
          <span className="text-xl font-black uppercase italic tracking-tighter text-white transition-colors group-hover:text-emerald-500">
            <span className="text-[#10b981]">E</span>state<span className="text-[#10b981]">OS</span>&trade;
          </span>
        </Link>

        <div className="pointer-events-none absolute left-1/2 top-1 z-[15] -translate-x-1/2 sm:hidden">
          <span className="relative overflow-hidden text-lg font-black uppercase italic tracking-tighter text-white shimmer-logo">
            <span className="text-[#10b981]">E</span>state<span className="text-[#10b981]">OS</span>&trade;
          </span>
        </div>

        {user && (
          <div className="absolute left-1/2 top-9 z-[12] flex -translate-x-1/2 flex-col items-center sm:top-1 md:top-2">
            <PremiumModeToggle currentUser={user} />
          </div>
        )}

        {/* Desktop: linki — przy zalogowanym zostawiamy miejsce na centralny przełącznik trybu */}
        <div
          className={clsx(
            "hidden min-w-0 flex-1 items-center px-4 lg:flex xl:px-8",
            user ? "justify-start xl:pl-44 2xl:pl-56" : "justify-center",
          )}
        >
          <div className="flex max-w-full flex-wrap items-center justify-center gap-0.5 md:gap-1.5">
            {DESKTOP_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center justify-end gap-4 lg:flex">
          {user && <NotificationCenter />}

          {user ? (
            <div className="ml-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(user.role === "ADMIN" ? "/centrala" : "/moje-konto")}
                style={{
                  backgroundColor: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#10b981",
                }}
                className="rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              >
                {user.role === "ADMIN" ? "Centrala" : "Zarządzaj"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-red-400"
                aria-label="Wyloguj"
              >
                <LogOut size={18} aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:text-emerald-500"
            >
              Zaloguj <LogIn size={14} aria-hidden />
            </button>
          )}
        </div>

        <div className="relative z-40 mt-0.5 flex items-center gap-2 lg:hidden">
          {user && <NotificationCenter />}
          <button
            type="button"
            id="mobile-menu-button"
            aria-expanded={isOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setIsOpen((v) => !v)}
            className="rounded-xl border border-white/10 bg-black/35 p-2 text-white transition-colors hover:text-emerald-500"
          >
            {isOpen ? <X size={24} aria-hidden /> : <Menu size={24} aria-hidden />}
            <span className="sr-only">{isOpen ? "Zamknij menu" : "Otwórz menu"}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            {...motionMenu}
            id="mobile-nav-panel"
            role="region"
            aria-labelledby="mobile-menu-button"
            className="border-b border-white/10 bg-[#0a0a0a] shadow-2xl lg:hidden"
          >
            <div className="flex max-h-[min(70vh,calc(100dvh-8rem))] flex-col gap-8 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
              <div className="mt-2 space-y-2 px-1">
                <button
                  type="button"
                  onClick={() => handleNavClick("/", true)}
                  className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-black uppercase tracking-widest text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <Home size={18} className="text-zinc-600" aria-hidden />
                  Odkryj mapę
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick("/oferty")}
                  className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-black uppercase tracking-widest text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <Building2 size={18} className="text-zinc-600" aria-hidden />
                  Rynek nieruchomości
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick("/dodaj-oferte")}
                  className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-black uppercase tracking-widest text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <PlusCircle size={18} className="text-zinc-600" aria-hidden />
                  Dodaj ofertę
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick("/cennik")}
                  className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-black uppercase tracking-widest text-[#D4AF37] transition-colors hover:bg-white/[0.04] hover:text-[#FFF0AA]"
                >
                  <Crown size={18} aria-hidden />
                  EstateOS™ Elite
                </button>
              </div>
              <div className="h-px bg-white/5" />
              <div className="space-y-2 px-1">
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNavClick(user.role === "ADMIN" ? "/centrala" : "/moje-konto")}
                      className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-black uppercase tracking-widest text-emerald-500 transition-colors hover:bg-emerald-500/10"
                    >
                      <Shield size={18} aria-hidden />{" "}
                      {user.role === "ADMIN" ? "Zarządzaj (Centrala)" : "Zarządzaj kontem"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-black uppercase tracking-widest text-red-500/80 transition-colors hover:bg-red-500/10"
                    >
                      <LogOut size={18} aria-hidden />
                      Wyloguj
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleNavClick("/login")}
                    style={{
                      backgroundColor: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl p-4 text-left text-xs font-black uppercase tracking-[0.2em] text-emerald-500"
                  >
                    <User size={18} aria-hidden />
                    Zaloguj do systemu
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReviewPrompt />
      <style jsx>{`
        .shimmer-logo::after {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 150%;
          height: 100%;
          background: linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.35), transparent 70%);
          transform: skewX(-20deg);
          animation: shimmerMove 15s infinite;
        }
        @keyframes shimmerMove {
          0% {
            left: -150%;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          10% {
            left: 150%;
            opacity: 0;
          }
          100% {
            left: 150%;
            opacity: 0;
          }
        }
      `}</style>
    </nav>
  );
}
