"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  CrmMetallicGearsCanvas,
  type GearAnimPhase,
} from "@/components/account/CrmMetallicGearsCanvas";

type OriginRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
};

type LaunchApi = {
  isLaunching: boolean;
  startLaunch: (opts: { href: string; origin: OriginRect }) => void;
  notifyReady: () => void;
};

const CrmLaunchContext = createContext<LaunchApi | null>(null);

const MIN_SPIN_MS = 900;
const READY_TIMEOUT_MS = 14000;

export function useCrmLaunch(): LaunchApi {
  const ctx = useContext(CrmLaunchContext);
  if (!ctx) {
    throw new Error("useCrmLaunch must be used within CrmLaunchProvider");
  }
  return ctx;
}

export function useCrmLaunchOptional(): LaunchApi | null {
  return useContext(CrmLaunchContext);
}

export default function CrmLaunchProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const timersRef = useRef<number[]>([]);
  const spinStartedAtRef = useRef(0);
  const readyRef = useRef(false);
  const launchedRef = useRef(false);
  const revealScheduledRef = useRef(false);
  const phaseRef = useRef<GearAnimPhase>("idle");
  const exitingRef = useRef(false);

  const [origin, setOrigin] = useState<OriginRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [phase, setPhase] = useState<GearAnimPhase>("idle");
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isLaunching = Boolean(origin);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const setPhaseSafe = useCallback((next: GearAnimPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    launchedRef.current = false;
    readyRef.current = false;
    revealScheduledRef.current = false;
    spinStartedAtRef.current = 0;
    phaseRef.current = "idle";
    exitingRef.current = false;
    setOrigin(null);
    setExpanded(false);
    setShowTitle(false);
    setPhase("idle");
    setExiting(false);
  }, [clearTimers]);

  const beginScatter = useCallback(() => {
    if (!launchedRef.current) return;
    if (phaseRef.current === "scatter" || exitingRef.current) return;
    setPhaseSafe("scatter");
  }, [setPhaseSafe]);

  const tryReveal = useCallback(() => {
    if (!launchedRef.current || phaseRef.current === "scatter" || exitingRef.current) return;
    if (!readyRef.current) return;
    if (phaseRef.current !== "spin") return;
    if (revealScheduledRef.current) return;
    revealScheduledRef.current = true;
    const elapsed = Date.now() - spinStartedAtRef.current;
    const wait = Math.max(0, MIN_SPIN_MS - elapsed);
    if (wait <= 0) beginScatter();
    else schedule(beginScatter, wait);
  }, [beginScatter, schedule]);

  const notifyReady = useCallback(() => {
    if (!launchedRef.current) return;
    readyRef.current = true;
    tryReveal();
  }, [tryReveal]);

  const startLaunch = useCallback(
    (opts: { href: string; origin: OriginRect }) => {
      if (launchedRef.current) return;
      launchedRef.current = true;
      readyRef.current = false;
      revealScheduledRef.current = false;
      exitingRef.current = false;
      clearTimers();
      setOrigin(opts.origin);
      setExpanded(false);
      setShowTitle(false);
      setPhaseSafe("idle");
      setExiting(false);

      router.prefetch(opts.href);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setExpanded(true));
      });

      schedule(() => {
        router.push(opts.href);
      }, 220);

      schedule(() => {
        setShowTitle(true);
        setPhaseSafe("spin");
        spinStartedAtRef.current = Date.now();
        tryReveal();
      }, 480);

      schedule(() => {
        readyRef.current = true;
        tryReveal();
      }, READY_TIMEOUT_MS);
    },
    [clearTimers, router, schedule, setPhaseSafe, tryReveal],
  );

  const handleScatterComplete = useCallback(() => {
    exitingRef.current = true;
    setExiting(true);
    schedule(reset, 640);
  }, [reset, schedule]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const api = useMemo<LaunchApi>(
    () => ({ isLaunching, startLaunch, notifyReady }),
    [isLaunching, notifyReady, startLaunch],
  );

  return (
    <CrmLaunchContext.Provider value={api}>
      {children}
      {mounted && origin
        ? createPortal(
            <div
              className={[
                "eos-agent-crm-cta__portal",
                expanded ? "is-expanded" : "",
                showTitle ? "is-title-visible" : "",
                phase === "scatter" ? "is-scattering" : "",
                exiting ? "is-exiting" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden
              style={{
                top: origin.top,
                left: origin.left,
                width: origin.width,
                height: origin.height,
                borderRadius: origin.borderRadius,
              }}
            >
              <div className={`eos-agent-crm-cta__portal-gears${phase === "scatter" ? " is-scattering" : ""}`}>
                <CrmMetallicGearsCanvas
                  mode="portal"
                  active
                  boost={phase === "spin"}
                  phase={phase}
                  onScatterComplete={handleScatterComplete}
                  className="eos-agent-crm-cta__portal-gears-canvas"
                />
              </div>
              <div className="eos-agent-crm-cta__portal-vignette" />
              <div className="eos-agent-crm-cta__portal-title">
                <span className="eos-agent-crm-cta__portal-kicker">EstateOS™ Desk</span>
                <span className="eos-agent-crm-cta__portal-crm">CRM</span>
              </div>
              <span className="eos-agent-crm-cta__portal-sheen" />
            </div>,
            document.body,
          )
        : null}
    </CrmLaunchContext.Provider>
  );
}
