'use client';

import { useCallback, useEffect, useState } from 'react';
import { DESK_UI } from '@/lib/desk/labels';

type HomePayload = {
  asset: 'home';
  offer: {
    id: number;
    title: string | null;
    status: string;
    pricePln: number | null;
    listPricePln: number | null;
    pricePerM2: number | null;
    city: string | null;
    district: string | null;
    area: number | null;
    rooms: number | null;
    lat: number | null;
    lng: number | null;
  };
  metrics: { views: number; matches: number; openHouseGuests: number };
  priceHistory: Array<{ at: string; pricePln: number; changeType: string }>;
  seller: { firstName: string; lastName: string; phone: string | null; email: string | null } | null;
  listingAgent: { name: string | null; email: string | null; phone: string | null } | null;
  deskCase: { id: number; pipelineStage: string } | null;
  deals: Array<{ id: number; status: string; buyer: { name: string | null } | null }>;
};

type CarPayload = {
  asset: 'car';
  car: {
    id: number;
    title: string;
    make: string;
    model: string;
    year: number;
    mileageKm: number;
    pricePln: number;
    city: string;
    cepik: Record<string, string>;
  };
};

export function DeskOfferInspector({
  offerId,
  asset = 'home',
  onOpenCase,
  onOpenMap,
}: {
  offerId: number | null;
  asset?: 'home' | 'car';
  onOpenCase?: (caseId: number) => void;
  onOpenMap?: (lat: number, lng: number) => void;
}) {
  const [data, setData] = useState<HomePayload | CarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!offerId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/desk/offers/${offerId}/inspector?asset=${asset}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Błąd');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [offerId, asset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!offerId) {
    return (
      <div className="eos-desk-inspector-empty">
        <p className="eos-desk-kicker">{DESK_UI.offerPanel}</p>
        <h2 className="eos-desk-h1 eos-desk-inspector-title">{DESK_UI.offerPickTitle}</h2>
        <p className="eos-desk-muted eos-desk-inspector-empty__hint">{DESK_UI.offerPickHint}</p>
      </div>
    );
  }

  if (loading && !data) return <p className="eos-desk-muted">Ładuję ofertę…</p>;
  if (error) return <p style={{ color: 'var(--desk-danger)' }}>{error}</p>;
  if (!data) return null;

  if (data.asset === 'car') {
    const c = data.car;
    return (
      <div>
        <p className="eos-desk-kicker">CAR · #{c.id}</p>
        <h2 className="eos-desk-h1" style={{ fontSize: '1.2rem' }}>
          {c.title}
        </h2>
        <div className="eos-desk-card" style={{ marginTop: '0.65rem', padding: '0.75rem', fontSize: '0.88rem' }}>
          <div>
            {c.make} {c.model} · {c.year}
          </div>
          <div>{c.mileageKm.toLocaleString('pl-PL')} km · {c.pricePln.toLocaleString('pl-PL')} PLN</div>
          <div>{c.city}</div>
          <p className="eos-desk-kicker" style={{ marginTop: '0.65rem' }}>
            CEPIK
          </p>
          <div>VIN: {c.cepik.vin || '—'}</div>
          <div>Rej.: {c.cepik.registrationNumber || '—'}</div>
        </div>
      </div>
    );
  }

  const o = data.offer;
  return (
    <div>
      <p className="eos-desk-kicker">HOME · #{o.id}</p>
      <h2 className="eos-desk-h1" style={{ fontSize: '1.2rem' }}>
        {o.title}
      </h2>
      <span className="eos-desk-chip">{o.status}</span>

      <div className="eos-desk-metrics-row" style={{ marginTop: '0.65rem' }}>
        <div className="eos-desk-metric">
          <span>Cena</span>
          <strong>{o.pricePln?.toLocaleString('pl-PL') || '—'}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>PLN/m²</span>
          <strong>{o.pricePerM2?.toLocaleString('pl-PL') || '—'}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>Views</span>
          <strong>{data.metrics.views}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>Matching</span>
          <strong>{data.metrics.matches}</strong>
        </div>
      </div>

      {data.priceHistory.length > 1 ? (
        <div style={{ marginTop: '0.65rem', fontSize: '0.85rem' }}>
          <p className="eos-desk-kicker">Historia ceny</p>
          {data.priceHistory.slice(-4).map((h) => (
            <div key={h.at}>
              {new Date(h.at).toLocaleDateString('pl-PL')} · {Math.round(h.pricePln).toLocaleString('pl-PL')} ·{' '}
              {h.changeType}
            </div>
          ))}
        </div>
      ) : null}

      {data.seller ? (
        <div className="eos-desk-card" style={{ marginTop: '0.65rem', padding: '0.65rem', fontSize: '0.88rem' }}>
          <p className="eos-desk-kicker">Seller</p>
          {data.seller.firstName} {data.seller.lastName}
          {data.seller.phone ? ` · ${data.seller.phone}` : ''}
        </div>
      ) : null}

      {data.deskCase ? (
        <button
          type="button"
          className="eos-desk-btn eos-desk-btn-brass"
          style={{ marginTop: '0.65rem' }}
          onClick={() => onOpenCase?.(data.deskCase!.id)}
        >
          Otwórz sprawę · {data.deskCase.pipelineStage}
        </button>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem' }}>
        {o.lat != null && o.lng != null ? (
          <button type="button" className="eos-desk-btn" onClick={() => onOpenMap?.(o.lat!, o.lng!)}>
            OPEN MAP
          </button>
        ) : null}
        <a className="eos-desk-btn" href={`/oferta/${o.id}`} target="_blank" rel="noreferrer">
          Otwórz ofertę
        </a>
      </div>
    </div>
  );
}
