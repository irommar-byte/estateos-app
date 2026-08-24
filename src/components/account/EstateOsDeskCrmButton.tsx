'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmMetallicGearsCanvas } from '@/components/account/CrmMetallicGearsCanvas';
import { useCrmLaunchOptional } from '@/components/account/CrmLaunchProvider';

export default function EstateOsDeskCrmButton({
  href = "/moje-konto/crm?from=desk",
}: {
  href?: string;
}) {
  const router = useRouter();
  const launch = useCrmLaunchOptional();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (launch?.isLaunching) return;
    const el = btnRef.current;
    if (!el) {
      router.push(href);
      return;
    }

    router.prefetch(href);
    const rect = el.getBoundingClientRect();
    if (launch) {
      launch.startLaunch({
        href,
        origin: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: '1.5rem',
        },
      });
      return;
    }
    router.push(href);
  }, [href, launch, router]);

  return (
    <button
      ref={btnRef}
      type="button"
      className={`eos-agent-crm-cta min-w-[18rem] sm:min-w-[19.5rem]${hovered ? ' is-hovered' : ''}${launch?.isLaunching ? ' is-launching' : ''}`}
      aria-label="Otwórz EstateOS Desk CRM"
      onMouseEnter={() => {
        setHovered(true);
        router.prefetch(href);
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      <span className="eos-agent-crm-cta__halo" aria-hidden />
      <span className="eos-agent-crm-cta__plate">
        <span className="eos-agent-crm-cta__gears" aria-hidden>
          <CrmMetallicGearsCanvas
            mode="button"
            active={hovered}
            boost={Boolean(launch?.isLaunching)}
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
  );
}
