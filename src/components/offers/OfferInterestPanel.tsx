'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { Eye, Flame, Timer } from 'lucide-react';
import type { FloorPlanScanMeta } from '@/types/roomScan';
import { normalizeScanMeta } from '@/lib/roomScan/planNormalize';
import { resolveWholePlanMeta } from '@/lib/roomScan/wholePlan';
import { parseFloorPlanScanMeta } from '@/lib/roomScan/parseFloorPlanScanMeta';
import FloorPlanScanArtboard from '@/components/offers/FloorPlanScanArtboard';

type Summary = {
  rooms: Array<{ room: string; views: number; dwellMs: number; share: number }>;
  photos: Array<{ url: string; room: string | null; views: number; dwellMs: number }>;
  totalDwellMs: number;
  totalViews: number;
};

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration: 1.3, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduce, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

const fmtSeconds = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
};

/**
 * „Najbardziej oglądana: kuchnia” — mapa ciepła na rzucie, ranking pokoi i zdjęcia, przy których klienci zatrzymują się najdłużej.
 * Dla agenta (strona oferty) i sprzedającego (panel klienta, ?portal=token).
 */
export default function OfferInterestPanel({
  offerId,
  portalToken,
  scanMeta: scanMetaProp,
  title = 'Zainteresowanie klientów',
}: {
  offerId: number;
  portalToken?: string | null;
  scanMeta?: FloorPlanScanMeta | null;
  title?: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scanMeta, setScanMeta] = useState<FloorPlanScanMeta | null>(scanMetaProp ?? null);

  useEffect(() => {
    let alive = true;
    const qs = portalToken ? `?portal=${encodeURIComponent(portalToken)}` : '';
    fetch(`/api/offers/${offerId}/engagement${qs}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => alive && data && setSummary(data as Summary))
      .catch(() => undefined);
    if (!scanMetaProp) {
      fetch(`/api/offers/${offerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const offer = data?.offer || data;
          if (alive && offer?.floorPlanScanMeta) setScanMeta(parseFloorPlanScanMeta(offer.floorPlanScanMeta));
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [offerId, portalToken, scanMetaProp]);

  const normalized = useMemo(() => (scanMeta ? normalizeScanMeta(resolveWholePlanMeta(scanMeta).meta) : null), [scanMeta]);
  const heat = useMemo(() => {
    if (!summary?.rooms.length) return null;
    const max = Math.max(...summary.rooms.map((r) => r.dwellMs)) || 1;
    return Object.fromEntries(summary.rooms.map((r) => [r.room.toLocaleLowerCase('pl'), r.dwellMs / max]));
  }, [summary]);

  if (!summary) return null;
  const top = summary.rooms[0];
  const hasData = summary.rooms.length > 0 || summary.photos.length > 0;

  return (
    <section className="eos-interest">
      <div className="eos-interest__head">
        <div>
          <p className="eos-interest__kicker">
            <Flame size={13} /> {title}
          </p>
          {top ? (
            <h3 className="eos-interest__headline">
              Najbardziej oglądana: <span>{top.room.toLocaleLowerCase('pl')}</span>
            </h3>
          ) : (
            <h3 className="eos-interest__headline">Zbieramy pierwsze sygnały</h3>
          )}
          <p className="eos-interest__sub">
            {hasData
              ? 'Gdzie klienci zatrzymują wzrok — liczone z czasu oglądania zdjęć i kliknięć w pokoje na rzucie.'
              : 'Gdy klienci zaczną oglądać zdjęcia i rzut, tutaj zobaczysz, które pomieszczenia przyciągają najbardziej.'}
          </p>
        </div>
        {hasData ? (
          <div className="eos-interest__totals">
            <span>
              <Eye size={13} /> <CountUp to={summary.totalViews} />
            </span>
            <span>
              <Timer size={13} /> {fmtSeconds(summary.totalDwellMs)}
            </span>
          </div>
        ) : null}
      </div>

      {hasData ? (
        <div className="eos-interest__grid">
          {normalized?.walls?.length ? (
            <div className="eos-interest__plan">
              <FloorPlanScanArtboard walls={normalized.walls} meta={normalized} width={640} height={440} locale="pl" heat={heat} />
            </div>
          ) : null}
          <div className="eos-interest__rooms">
            {summary.rooms.slice(0, 6).map((room, i) => (
              <div key={room.room} className="eos-interest__row" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="eos-interest__row-head">
                  <span className="eos-interest__room">{room.room}</span>
                  <span className="eos-interest__pct">
                    <CountUp to={Math.round(room.share * 100)} suffix="%" />
                  </span>
                </div>
                <div className="eos-interest__bar">
                  <span style={{ width: `${Math.max(4, room.share * 100)}%`, animationDelay: `${i * 70 + 150}ms` }} />
                </div>
              </div>
            ))}
            {summary.photos.length ? (
              <div className="eos-interest__photos">
                {summary.photos.slice(0, 4).map((photo) => (
                  <figure key={photo.url} className="eos-interest__photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" loading="lazy" />
                    <figcaption>
                      {photo.room ? <b>{photo.room}</b> : null}
                      {fmtSeconds(photo.dwellMs)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
