'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CrmMetallicGearsCanvas,
  type GearAnimPhase,
} from '@/components/account/CrmMetallicGearsCanvas';

type PortalRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
};

export default function EstateOsDeskCrmButton() {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const timersRef = useRef<number[]>([]);
  const [hovered, setHovered] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [portal, setPortal] = useState<PortalRect | null>(null);
  const [portalExpanded, setPortalExpanded] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [gearPhase, setGearPhase] = useState<GearAnimPhase>('idle');
  const [exiting, setExiting] = useState(false);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const resetPortal = useCallback(() => {
    setPortal(null);
    setPortalExpanded(false);
    setShowTitle(false);
    setGearPhase('idle');
    setExiting(false);
    setLaunching(false);
    clearTimers();
  }, [clearTimers]);

  const handleScatterComplete = useCallback(() => {
    setExiting(true);
    schedule(() => router.push('/crm'), 380);
    schedule(resetPortal, 980);
  }, [resetPortal, router, schedule]);

  const handleClick = useCallback(() => {
    if (launching) return;
    const el = btnRef.current;
    if (!el) {
      router.push('/crm');
      return;
    }

    clearTimers();
    const rect = el.getBoundingClientRect();
    setPortal({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: '1.5rem',
    });
    setLaunching(true);
    setPortalExpanded(false);
    setShowTitle(false);
    setGearPhase('idle');
    setExiting(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPortalExpanded(true));
    });

    // Tytuł CRM + szybki obrót zębatek (1 s)
    schedule(() => {
      setShowTitle(true);
      setGearPhase('spin');
    }, 900);

    // Rozlatujące się zębatki
    schedule(() => setGearPhase('scatter'), 1900);
  }, [clearTimers, launching, router, schedule]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`eos-agent-crm-cta min-w-[18rem] sm:min-w-[19.5rem]${hovered ? ' is-hovered' : ''}${launching ? ' is-launching' : ''}`}
        aria-label="Otwórz EstateOS Desk CRM"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        <span className="eos-agent-crm-cta__halo" aria-hidden />
        <span className="eos-agent-crm-cta__plate">
          <span className="eos-agent-crm-cta__gears" aria-hidden>
            <CrmMetallicGearsCanvas
              mode="button"
              active={hovered}
              boost={launching}
              className="eos-agent-crm-cta__gears-canvas"
            />
          </span>
          <span className="eos-agent-crm-cta__sheen" aria-hidden />
          <span className="eos-agent-crm-cta__glow" aria-hidden />
          <span className="eos-agent-crm-cta__spark" aria-hidden />
          <span className="eos-agent-crm-cta__engraved">
            <span className="eos-agent-crm-cta__brand">EstateOS™</span>
            <span className="eos-agent-crm-cta__label">Desk CRM</span>
          </span>
        </span>
      </button>

      {portal ? (
        <div
          className={[
            'eos-agent-crm-cta__portal',
            portalExpanded ? 'is-expanded' : '',
            showTitle ? 'is-title-visible' : '',
            gearPhase === 'scatter' ? 'is-scattering' : '',
            exiting ? 'is-exiting' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden
          style={{
            top: portal.top,
            left: portal.left,
            width: portal.width,
            height: portal.height,
            borderRadius: portal.borderRadius,
          }}
        >
          <div className={`eos-agent-crm-cta__portal-gears${gearPhase === 'scatter' ? ' is-scattering' : ''}`}>
            <CrmMetallicGearsCanvas
              mode="portal"
              active
              boost={gearPhase === 'spin'}
              phase={gearPhase}
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
        </div>
      ) : null}
    </>
  );
}
