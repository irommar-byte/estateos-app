'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { DESK_NAV } from '@/lib/desk/labels';

type NavItem = (typeof DESK_NAV)[number] & {
  match: (pathname: string) => boolean;
};

const NAV: NavItem[] = DESK_NAV.map((item) => ({
  ...item,
  match:
    item.href === '/crm'
      ? (p: string) => p === '/crm'
      : (p: string) => p.startsWith(item.href),
}));

export function DeskRailNav({ pathname, variant = 'rail' }: { pathname: string; variant?: 'rail' | 'dock' }) {
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ offset: 0, size: 0, opacity: 0 });

  const items = NAV;
  const activeIndex = items.findIndex((item) => item.match(pathname));

  useLayoutEffect(() => {
    const update = () => {
      const el = linkRefs.current[activeIndex];
      const nav = navRef.current;
      if (!el || !nav || activeIndex < 0) {
        setIndicator((s) => ({ ...s, opacity: 0 }));
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (variant === 'dock') {
        setIndicator({
          offset: elRect.left - navRect.left + nav.scrollLeft,
          size: elRect.width,
          opacity: 1,
        });
      } else {
        setIndicator({
          offset: elRect.top - navRect.top + nav.scrollTop,
          size: elRect.height,
          opacity: 1,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [activeIndex, pathname, variant]);

  const className = variant === 'dock' ? 'eos-desk-mobile-dock' : 'eos-desk-rail';
  const isHorizontal = variant === 'dock';

  return (
    <nav ref={navRef} className={className} aria-label="Nawigacja Desk">
      <span
        className={`eos-desk-rail-indicator${isHorizontal ? ' eos-desk-rail-indicator--horizontal' : ''}`}
        aria-hidden
        style={
          isHorizontal
            ? {
                transform: `translateX(${indicator.offset}px)`,
                width: indicator.size,
                opacity: indicator.opacity,
              }
            : {
                transform: `translateY(${indicator.offset}px)`,
                height: indicator.size,
                opacity: indicator.opacity,
              }
        }
      />
      {items.map((item, i) => (
        <Link
          key={item.href}
          ref={(node) => {
            linkRefs.current[i] = node;
          }}
          href={item.href}
          data-active={item.match(pathname)}
        >
          {variant === 'dock' && 'dockLabel' in item && item.dockLabel ? item.dockLabel : item.label}
        </Link>
      ))}
    </nav>
  );
}
