'use client';

import { useCallback, useEffect, useState } from 'react';

type Report = {
  offer: { id: number; title: string | null; pricePln: number | null; city: string | null; district: string | null };
  metrics: {
    views: number;
    inquiries: number;
    interestedBuyers: number;
    presentations: number;
    openHouseGuests: number;
    activeMatches: number;
  };
  priceHistory: Array<{ at: string; pricePln: number; changeType: string }>;
  marketComparison: Array<{
    id: number;
    title: string | null;
    pricePln: number | null;
    pricePerM2: number | null;
    status: string;
  }>;
  priceRecommendation: {
    currentPrice: number;
    listPrice: number;
    discountPercent: number | null;
    vsMarketMedian: number | null;
    recommendation: string;
  };
  observations: string[];
  publications: Array<{ title: string; at: string; kind: string }>;
  debriefs: Array<{ at: string; title: string }>;
};

export function DeskSellerReport({
  offerId,
  clientId,
}: {
  offerId: number;
  clientId: number;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/desk/offers/${offerId}/seller-report?clientId=${clientId}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Błąd');
      setReport(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [offerId, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="eos-desk-muted">Ładuję raport…</p>;
  if (error) return <p style={{ color: 'var(--desk-danger)' }}>{error}</p>;
  if (!report) return null;

  return (
    <div className="eos-desk-seller-report">
      <p className="eos-desk-kicker">Raport dla sprzedającego</p>
      <h3 style={{ fontFamily: 'var(--desk-font-display)', margin: '0.25rem 0 0.75rem' }}>
        {report.offer.title || `Oferta #${offerId}`}
      </h3>

      <div className="eos-desk-metrics-row">
        <div className="eos-desk-metric">
          <span>Views</span>
          <strong>{report.metrics.views}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>Inquiries</span>
          <strong>{report.metrics.inquiries}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>HOT</span>
          <strong>{report.metrics.interestedBuyers}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>Prezentacje</span>
          <strong>{report.metrics.presentations}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>OH goście</span>
          <strong>{report.metrics.openHouseGuests}</strong>
        </div>
        <div className="eos-desk-metric">
          <span>Matching</span>
          <strong>{report.metrics.activeMatches}</strong>
        </div>
      </div>

      <div className="eos-desk-card" style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
        <p className="eos-desk-command-label">Rekomendacja ceny</p>
        <p style={{ margin: '0.35rem 0', fontWeight: 600 }}>{report.priceRecommendation.recommendation}</p>
        <p className="eos-desk-muted" style={{ fontSize: '0.85rem' }}>
          Cena: {report.priceRecommendation.currentPrice.toLocaleString('pl-PL')} PLN
          {report.priceRecommendation.discountPercent != null
            ? ` · obniżka ${report.priceRecommendation.discountPercent}%`
            : ''}
          {report.priceRecommendation.vsMarketMedian != null
            ? ` · vs rynek ${report.priceRecommendation.vsMarketMedian > 0 ? '+' : ''}${report.priceRecommendation.vsMarketMedian}%`
            : ''}
        </p>
      </div>

      {report.observations.length > 0 ? (
        <ul style={{ marginTop: '0.65rem', paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
          {report.observations.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      ) : null}

      {report.marketComparison.length > 0 ? (
        <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
          <p className="eos-desk-kicker">Porównanie z aktywnymi</p>
          <table className="eos-desk-table">
            <thead>
              <tr>
                <th>Oferta</th>
                <th>Cena</th>
                <th>PLN/m²</th>
              </tr>
            </thead>
            <tbody>
              {report.marketComparison.map((c) => (
                <tr key={c.id}>
                  <td>{c.title || `#${c.id}`}</td>
                  <td>{c.pricePln?.toLocaleString('pl-PL') || '—'}</td>
                  <td>{c.pricePerM2?.toLocaleString('pl-PL') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <button
        type="button"
        className="eos-desk-btn eos-desk-btn-brass"
        style={{ marginTop: '0.85rem' }}
        disabled={sending}
        onClick={async () => {
          setSending(true);
          try {
            const res = await fetch(`/api/desk/offers/${offerId}/seller-report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Nie wysłano');
            setSent(true);
          } catch (e) {
            alert(e instanceof Error ? e.message : 'Błąd');
          } finally {
            setSending(false);
          }
        }}
      >
        {sending ? 'Wysyłam…' : sent ? 'Wysłano do klienta ✓' : 'Wyślij raport (portal + e-mail)'}
      </button>
    </div>
  );
}
