'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, Coins, PenLine, Sparkles, X } from 'lucide-react';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { pln, relative } from './format';

type QueueOffer = {
  id: number;
  title: string | null;
  city: string | null;
  price: number | string | null;
  officeSubmittedAt: string | null;
  images?: unknown;
  area?: number | null;
  rooms?: number | null;
  user: { id: number; name: string | null } | null;
};
type SmartRequest = { userId: number; name: string; requestedAt: string };

const STALE_MS = 12 * 60 * 60 * 1000;

function openOfficeCoin() {
  window.dispatchEvent(new Event('openOfficeCredits'));
}

/**
 * Kierownik biura: prośby agentów o publikację z kredytu biura i o Smart Agent OS™.
 * Zatwierdzenie od razu pobiera kredyty z puli; przy pustej puli — przejście do dokupienia.
 */
export default function CrmOfficeApprovals() {
  const [offers, setOffers] = useState<QueueOffer[] | null>(null);
  const [smart, setSmart] = useState<SmartRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string; buy?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency-company/offers/office-review', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        setOffers(null);
        return;
      }
      const data = await res.json();
      setOffers(Array.isArray(data?.queue) ? data.queue : []);
      setSmart(Array.isArray(data?.smartRequests) ? data.smartRequests : []);
    } catch {
      setOffers(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    window.addEventListener('officeCreditsRefresh', load);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('officeCreditsRefresh', load);
    };
  }, [load]);

  const act = async (key: string, url: string, body: Record<string, unknown>, okText: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        const noCredit = data?.code === 'NO_OFFICE_CREDIT';
        setMsg({ ok: false, text: String(data?.error || 'Nie udało się.'), buy: noCredit });
        return;
      }
      setMsg({ ok: true, text: okText });
      setRejecting(null);
      setNote('');
      window.dispatchEvent(new Event('officeCreditsRefresh'));
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (offers == null || (offers.length === 0 && smart.length === 0)) return null;

  return (
    <section id="do-zatwierdzenia" className="crmx-card crmx-approvals scroll-mt-28">
      <header className="crmx-card__head">
        <h3 className="crmx-card__title">
          <Building2 /> Do zatwierdzenia <span className="crmx-chip crmx-chip--warn">{offers.length + smart.length}</span>
        </h3>
        <button type="button" className="crmx-link" onClick={openOfficeCoin}>Kredyty biura →</button>
      </header>

      <div className="crmx-list">
        {offers.map((o) => {
          const waiting = o.officeSubmittedAt ? Date.now() - new Date(o.officeSubmittedAt).getTime() : 0;
          const img = resolveOfferPrimaryImage(o as never);
          return (
            <div key={o.id} className="crmx-approvals__item">
              <div className="crmx-approvals__main">
                {img ? <img src={img} alt="" className="crmx-thumb" /> : <span className="crmx-thumb" />}
                <div className="min-w-0 flex-1">
                  <a href={`/oferta/${o.id}`} target="_blank" rel="noreferrer" className="crmx-row__title block hover:underline">
                    {o.title || `Oferta #${o.id}`}
                  </a>
                  <span className="crmx-row__sub block">
                    {[o.user?.name, o.city, o.price ? pln(Number(o.price)) : null, o.area ? `${o.area} m²` : null].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className={`crmx-chip ${waiting > STALE_MS ? 'crmx-chip--warn' : ''}`}>
                  czeka {o.officeSubmittedAt ? relative(o.officeSubmittedAt) : ''}
                </span>
              </div>
              {rejecting === o.id ? (
                <form
                  className="crmx-approvals__reject"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(`r${o.id}`, '/api/agency-company/offers/office-review', { action: 'reject', offerId: o.id, note }, 'Odesłane do poprawy — agent dostał Twoją uwagę.');
                  }}
                >
                  <label className="crmx-input" style={{ flex: 1 }}>
                    <PenLine size={14} />
                    <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Co poprawić? Np. lepsze zdjęcia salonu" />
                  </label>
                  <button type="submit" className="crmx-btn crmx-btn--sm" disabled={busy != null}>Odeślij</button>
                  <button type="button" className="crmx-btn crmx-btn--sm" onClick={() => setRejecting(null)}><X size={13} /></button>
                </form>
              ) : (
                <div className="crmx-approvals__actions">
                  <button
                    type="button"
                    className="crmx-btn crmx-btn--sm crmx-btn--primary"
                    disabled={busy != null}
                    onClick={() => void act(`a${o.id}`, '/api/agency-company/offers/office-review', { action: 'approve', offerId: o.id }, 'Zatwierdzone — opłacone 1 kredytem biura.')}
                  >
                    <Check size={13} /> Zatwierdź · 1 kredyt biura
                  </button>
                  <button type="button" className="crmx-btn crmx-btn--sm" disabled={busy != null} onClick={() => { setRejecting(o.id); setNote(''); }}>
                    Do poprawy
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {smart.map((r) => (
          <div key={`s${r.userId}`} className="crmx-approvals__item">
            <div className="crmx-approvals__main">
              <span className="crmx-avatar" aria-hidden><Sparkles size={15} /></span>
              <div className="min-w-0 flex-1">
                <span className="crmx-row__title block">{r.name} prosi o Smart Agent OS™</span>
                <span className="crmx-row__sub block">30 dni · 10 kredytów biura · link wyszukiwarki należy do biura</span>
              </div>
              <span className="crmx-chip">czeka {relative(r.requestedAt)}</span>
            </div>
            <div className="crmx-approvals__actions">
              <button
                type="button"
                className="crmx-btn crmx-btn--sm crmx-btn--primary"
                disabled={busy != null}
                onClick={() => void act(`sa${r.userId}`, '/api/crm/smart-agent', { action: 'approve_request', forUserId: r.userId }, `Smart Agent OS™ włączony dla: ${r.name}.`)}
              >
                <Check size={13} /> Włącz · 10 kredytów biura
              </button>
              <button
                type="button"
                className="crmx-btn crmx-btn--sm"
                disabled={busy != null}
                onClick={() => void act(`sr${r.userId}`, '/api/crm/smart-agent', { action: 'reject_request', forUserId: r.userId }, 'Prośba odrzucona.')}
              >
                Odrzuć
              </button>
            </div>
          </div>
        ))}
      </div>

      {msg ? (
        <div className="crmx-approvals__msg">
          <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p>
          {msg.buy ? (
            <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--gold" onClick={openOfficeCoin}>
              <Coins size={13} /> Dokup kredyty biurowe
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
