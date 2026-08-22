'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmMetallicGearsCanvas } from '@/components/account/CrmMetallicGearsCanvas';

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
  const [hovered, setHovered] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [portal, setPortal] = useState<PortalRect | null>(null);
  const [portalExpanded, setPortalExpanded] = useState(false);
  const [showTitle, setShowTitle] = useState(false);

  const handleClick = useCallback(() => {
    if (launching) return;
    const el = btnRef.current;
    if (!el) {
      router.push('/crm');
      return;
    }
    const rect = el.getBoundingClientRect();
    setPortal({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: '1.5rem',
    });
    setLaunching(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPortalExpanded(true);
        window.setTimeout(() => setShowTitle(true), 380);
      });
    });
    window.setTimeout(() => router.push('/crm'), 1180);
  }, [launching, router]);

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
            <CrmMetallicGearsCanvas mode="button" active={hovered} boost={launching} className="eos-agent-crm-cta__gears-canvas" />
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
          className={`eos-agent-crm-cta__portal${portalExpanded ? ' is-expanded' : ''}${showTitle ? ' is-title-visible' : ''}`}
          aria-hidden
          style={{
            top: portal.top,
            left: portal.left,
            width: portal.width,
            height: portal.height,
            borderRadius: portal.borderRadius,
          }}
        >
          <div className="eos-agent-crm-cta__portal-gears">
            <CrmMetallicGearsCanvas mode="portal" active boost className="eos-agent-crm-cta__portal-gears-canvas" />
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
