'use client';

import { useCallback, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, StickyNote } from 'lucide-react';

type Peek = { x: number; y: number; below: boolean; date: string; text: string; holiday?: string | null; extra?: ReactNode };

/** Podgląd notatki po najechaniu na dzień w kalendarzu — elegancka karta nad stroną (nie ucina jej karta kalendarza). */
export function useNotePeek() {
  const [peek, setPeek] = useState<Peek | null>(null);

  const bind = useCallback(
    (date: string, text: string | null | undefined, holiday?: string | null, extra?: ReactNode) => {
      if (!text?.trim() && !holiday) return {};
      return {
        onMouseEnter: (e: MouseEvent<HTMLElement>) => {
          const r = e.currentTarget.getBoundingClientRect();
          const below = r.top < 220;
          setPeek({ x: r.left + r.width / 2, y: below ? r.bottom + 10 : r.top - 10, below, date, text: (text || '').trim(), holiday, extra });
        },
        onMouseLeave: () => setPeek(null),
      };
    },
    [],
  );

  const layer =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="crmx">
            <AnimatePresence>
              {peek ? (
                <motion.div
                  key={peek.date}
                  className="crmx-peek"
                  style={{ left: peek.x, top: peek.y, transformOrigin: peek.below ? 'top center' : 'bottom center' }}
                  data-below={peek.below ? '1' : undefined}
                  initial={{ opacity: 0, y: peek.below ? -6 : 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="crmx-peek__head">
                    {peek.text ? <StickyNote size={13} /> : <Flag size={13} />}
                    {new Date(`${peek.date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {peek.holiday ? <p className="crmx-peek__holiday"><Flag size={14} />{peek.holiday}<span>dzień wolny od pracy</span></p> : null}
                  {peek.text ? <p className="crmx-peek__text">{peek.text}</p> : null}
                  {peek.extra}
                  {peek.text ? <p className="crmx-peek__foot">Kliknij dzień, aby edytować</p> : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>,
          document.body,
        )
      : null;

  return { bind, layer };
}
