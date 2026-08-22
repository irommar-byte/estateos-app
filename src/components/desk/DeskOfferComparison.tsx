'use client';

import { useMemo, useState } from 'react';

type OfferRow = {
  id: number;
  title: string | null;
  pricePln: number | null;
  area: number | null;
  rooms: number | null;
  city: string | null;
  district: string | null;
  status: string;
  score?: number;
};

export function DeskOfferComparison({
  offers,
  clientEmail,
}: {
  offers: OfferRow[];
  clientEmail?: string | null;
}) {
  const [selected, setSelected] = useState<number[]>([]);

  const rows = useMemo(
    () => offers.filter((o) => selected.includes(o.id)).slice(0, 4),
    [offers, selected],
  );

  const body = rows
    .map((o) => {
      const ppm = o.pricePln && o.area ? Math.round(o.pricePln / o.area) : null;
      return `• ${o.title || `#${o.id}`}
  ${o.city || ''} ${o.district || ''}
  Cena: ${o.pricePln?.toLocaleString('pl-PL') || '—'} zł
  Metraż: ${o.area || '—'} m² · ${ppm ? `${ppm} zł/m²` : ''}
  Pokoje: ${o.rooms || '—'}
  Dopasowanie: ${o.score != null ? `${o.score}%` : '—'}
  Status: ${o.status}`;
    })
    .join('\n\n');

  return (
    <div>
      <p className="eos-desk-kicker">Porównanie 2–4 ofert</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {offers.slice(0, 12).map((o) => (
          <li key={o.id} style={{ display: 'flex', gap: '0.5rem', padding: '0.35rem 0' }}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              disabled={!selected.includes(o.id) && selected.length >= 4}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                )
              }
            />
            <span style={{ fontSize: '0.85rem' }}>
              {o.title} · {o.pricePln?.toLocaleString('pl-PL')} zł
            </span>
          </li>
        ))}
      </ul>
      {rows.length >= 2 ? (
        <div className="eos-desk-card" style={{ marginTop: '0.65rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th align="left">Oferta</th>
                <th align="right">Cena</th>
                <th align="right">m²</th>
                <th align="right">zł/m²</th>
                <th align="right">Pokoje</th>
                <th align="left">Lokalizacja</th>
                <th align="right">Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const ppm = o.pricePln && o.area ? Math.round(o.pricePln / o.area) : null;
                return (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--desk-line)' }}>
                    <td>{o.title}</td>
                    <td align="right">{o.pricePln?.toLocaleString('pl-PL') || '—'}</td>
                    <td align="right">{o.area || '—'}</td>
                    <td align="right">{ppm || '—'}</td>
                    <td align="right">{o.rooms || '—'}</td>
                    <td>
                      {[o.district, o.city].filter(Boolean).join(', ')}
                    </td>
                    <td align="right">{o.score != null ? `${o.score}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {clientEmail ? (
            <a
              className="eos-desk-btn eos-desk-btn-primary"
              style={{ marginTop: '0.65rem' }}
              href={`mailto:${clientEmail}?subject=${encodeURIComponent('Porównanie ofert')}&body=${encodeURIComponent(body)}`}
            >
              Send comparison
            </a>
          ) : null}
        </div>
      ) : (
        <p className="eos-desk-muted" style={{ fontSize: '0.82rem', marginTop: '0.45rem' }}>
          Zaznacz 2–4 oferty.
        </p>
      )}
    </div>
  );
}
