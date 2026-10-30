'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Check, Mail, Phone, User, X, Home } from 'lucide-react';
import { buyerName, STAGE_SHORT, type ProDeal } from './CrmPulpit';
import { pln, relative } from './format';

/** Okno transakcji: dlaczego kupujący jest w lejku, gdzie jest teraz i jaki jest następny krok — z przyciskami. */

function when(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function localInput(offsetDays: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CrmDealSheet({
  deal,
  onClose,
  onOpenClient,
  onOpenOffer,
}: {
  deal: ProDeal | null;
  onClose: () => void;
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  useEffect(() => {
    if (!deal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deal, onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {deal ? (
        <>
          <motion.div key="scrim" className="crmx-drawer-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            key="sheet"
            className="crmx crmx-drawer"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <SheetBody deal={deal} onClose={onClose} onOpenClient={onOpenClient} onOpenOffer={onOpenOffer} />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function SheetBody({
  deal,
  onClose,
  onOpenClient,
  onOpenOffer,
}: {
  deal: ProDeal;
  onClose: () => void;
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [slots, setSlots] = useState<string[]>([localInput(1, 17), localInput(2, 11), '']);
  const [agreed, setAgreed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const client = deal.buyer.kind === 'client' ? deal.buyer : null;
  const phone = deal.buyer.phone;
  const email = deal.buyer.email;
  const pres = deal.presentation;
  const stage = deal.stage;
  const clientProposed = stage === 'scheduling' && pres?.proposedBy === 'client';

  const run = async (url: string, body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(String(json?.error || json?.message || 'Nie udało się.'));
      setMsg({ ok: true, text: ok });
      setFormOpen(false);
      window.dispatchEvent(new Event('crm-deals-refresh'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Nie udało się.' });
    } finally {
      setBusy(false);
    }
  };

  const dealAction = (action: string, extra: Record<string, unknown>, ok: string) =>
    run('/api/crm/offer-buyers', { action, dealId: deal.id, ...extra }, ok);

  const proposeSlots = () => {
    const picked = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    if (!picked.length) return setMsg({ ok: false, text: 'Wybierz co najmniej jeden termin.' });
    if (client) {
      return run(
        `/api/crm/clients/${client.clientId}`,
        { action: 'propose_presentation', offerId: deal.offerId, startsAt: picked[0], startsAtList: agreed ? [picked[0]] : picked, confirmed: agreed },
        agreed ? 'Prezentacja zapisana jako umówiona.' : 'Terminy wysłane do kupującego — wybierze jeden w swoim panelu.',
      );
    }
    return dealAction('schedule_external', { startsAt: picked[0] }, 'Prezentacja zapisana.');
  };

  const scheduleForm = (
    <div className="crmx-dealsheet__form">
      <p className="crmx-dealsheet__hint">
        {client
          ? agreed
            ? 'Termin ustalony z kupującym — zapiszę go od razu jako umówioną prezentację.'
            : 'Zaproponuj do 3 terminów. Kupujący wybierze jeden w swoim panelu i dostanie przypomnienie.'
          : 'Wpisz uzgodniony termin prezentacji.'}
      </p>
      {(client && !agreed ? slots : slots.slice(0, 1)).map((value, i) => (
        <label key={i} className="crmx-input">
          <CalendarClock />
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setSlots((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
          />
        </label>
      ))}
      {client ? (
        <label className="crmx-dealsheet__check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          Termin już uzgodniony z kupującym (np. telefonicznie)
        </label>
      ) : null}
      <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void proposeSlots()}>
        {client && !agreed ? 'Wyślij terminy kupującemu' : 'Zapisz prezentację'}
      </button>
    </div>
  );

  let step: { title: string; body: React.ReactNode } | null = null;
  if (deal.status === 'ACTIVE' || deal.status === 'PAUSED') {
    if (stage === 'interested') {
      step = { title: 'Umów prezentację', body: scheduleForm };
    } else if (stage === 'scheduling') {
      step = clientProposed
        ? {
            title: 'Kupujący proponuje termin',
            body: (
              <div className="crmx-dealsheet__form">
                <p className="crmx-dealsheet__hint">Termin od kupującego: <b>{pres ? when(pres.startsAt) : '—'}</b></p>
                <button
                  type="button"
                  className="crmx-btn crmx-btn--gold"
                  disabled={busy || !client}
                  onClick={() => client && void run(`/api/crm/clients/${client.clientId}`, { action: 'accept_schedule_change', kind: 'presentation' }, 'Termin potwierdzony — prezentacja umówiona.')}
                >
                  <Check size={15} /> Potwierdź ten termin
                </button>
                <button type="button" className="crmx-btn" onClick={() => setFormOpen((v) => !v)}>Zaproponuj inne terminy</button>
                {formOpen ? scheduleForm : null}
              </div>
            ),
          }
        : {
            title: 'Czekamy, aż kupujący wybierze termin',
            body: (
              <div className="crmx-dealsheet__form">
                <p className="crmx-dealsheet__hint">
                  Wysłane terminy: {(pres?.proposedSlots || (pres ? [pres.startsAt] : [])).map(when).join(' · ') || '—'}
                </p>
                {phone ? <a className="crmx-btn" href={`tel:${phone}`}><Phone size={15} /> Zadzwoń i przypomnij</a> : null}
                <button type="button" className="crmx-btn" onClick={() => setFormOpen((v) => !v)}>Zmień terminy</button>
                {formOpen ? scheduleForm : null}
              </div>
            ),
          };
    } else if (stage === 'scheduled' || stage === 'live') {
      step = {
        title: stage === 'live' ? 'Prezentacja trwa' : `Prezentacja ${pres ? when(pres.startsAt) : ''}`,
        body: (
          <div className="crmx-dealsheet__form">
            <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void dealAction('mark_viewed', {}, 'Prezentacja oznaczona jako odbyta.')}>
              <Check size={15} /> Oznacz jako odbytą
            </button>
            <button type="button" className="crmx-btn" onClick={() => setFormOpen((v) => !v)}>Przełóż termin</button>
            {formOpen ? scheduleForm : null}
          </div>
        ),
      };
    } else if (stage === 'viewed') {
      step = {
        title: 'Jak kupującemu się podobało?',
        body: (
          <div className="crmx-dealsheet__form">
            <div className="crmx-dealsheet__row">
              <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void dealAction('set_feedback', { sentiment: 'like' }, 'Zapisano: podoba się.')}>Podoba się</button>
              <button type="button" className="crmx-btn" disabled={busy} onClick={() => void dealAction('set_feedback', { sentiment: 'maybe' }, 'Zapisano: do przemyślenia.')}>Do przemyślenia</button>
              <button type="button" className="crmx-btn" disabled={busy} onClick={() => void dealAction('set_feedback', { sentiment: 'dislike' }, 'Zapisano: nie pasuje.')}>Nie pasuje</button>
            </div>
            {client ? (
              <button type="button" className="crmx-btn" disabled={busy} onClick={() => void dealAction('request_feedback', {}, 'Poprosiliśmy kupującego o opinię w panelu.')}>
                Poproś kupującego o opinię
              </button>
            ) : null}
          </div>
        ),
      };
    } else if (stage === 'feedback') {
      step = {
        title: deal.feedback?.sentiment === 'dislike' ? 'Kupujący: nie pasuje' : 'Opinia zebrana — co dalej?',
        body: (
          <div className="crmx-dealsheet__form">
            {deal.feedback?.note ? <p className="crmx-dealsheet__hint">„{deal.feedback.note}”</p> : null}
            {deal.feedback?.sentiment !== 'dislike' ? (
              <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void dealAction('start_negotiation', {}, 'Negocjacje rozpoczęte.')}>
                Rozpocznij negocjacje
              </button>
            ) : null}
            {deal.seller ? (
              <button type="button" className="crmx-btn" disabled={busy} onClick={() => void dealAction('inform_seller', {}, 'Sprzedający dostał informację.')}>
                Poinformuj sprzedającego
              </button>
            ) : null}
          </div>
        ),
      };
    } else {
      step = {
        title: deal.nextAction,
        body: (
          <div className="crmx-dealsheet__form">
            <p className="crmx-dealsheet__hint">Negocjacje, rezerwację i dokumenty prowadzisz na karcie kupującego.</p>
            {client ? <button type="button" className="crmx-btn crmx-btn--gold" onClick={() => onOpenClient(client.clientId)}>Przejdź do negocjacji</button> : null}
          </div>
        ),
      };
    }
  }

  return (
    <div className="crmx-dealsheet">
      <div className="crmx-dealsheet__head">
        {deal.offer.imageUrl ? <img src={deal.offer.imageUrl} alt="" className="crmx-thumb" style={{ width: 52, height: 52, borderRadius: 12 }} /> : <span className="crmx-thumb" style={{ width: 52, height: 52 }} />}
        <div className="min-w-0 flex-1">
          <p className="crmx-eyebrow">{STAGE_SHORT[stage] || stage}</p>
          <h3 className="crmx-dealsheet__title">{buyerName(deal)}</h3>
          <p className="truncate text-[12.5px] crmx-muted">{deal.offer.title} · {pln(deal.offer.price)}</p>
        </div>
        <button type="button" className="crmx-dealsheet__close" onClick={onClose} aria-label="Zamknij"><X size={18} /></button>
      </div>

      {deal.entry ? (
        <p className="crmx-deal__why" style={{ WebkitLineClamp: 'unset' as unknown as number }}>
          <b>Dlaczego tutaj:</b> {deal.entry.reason}
          {deal.entry.at ? <span className="crmx-muted"> · {relative(deal.entry.at)}</span> : null}
        </p>
      ) : null}

      {deal.phases?.length ? (
        <ol className="crmx-dealsheet__phases">
          {deal.phases.map((p) => (
            <li key={p.id} data-done={p.done || undefined} data-current={p.current || undefined} data-skipped={p.skipped || undefined}>
              <span className="crmx-dealsheet__dot">{p.done ? <Check size={11} /> : null}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold">{p.label}</span>
                {p.summary ? <span className="block text-[11.5px] crmx-muted">{p.summary}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {step ? (
        <section className="crmx-card crmx-dealsheet__step">
          <p className="crmx-eyebrow">Następny krok</p>
          <h4 className="crmx-dealsheet__steptitle">{step.title}</h4>
          {step.body}
          {msg ? <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
        </section>
      ) : null}

      <div className="crmx-dealsheet__row">
        {phone ? <a className="crmx-btn" href={`tel:${phone}`}><Phone size={15} /> Zadzwoń</a> : null}
        {email ? <a className="crmx-btn" href={`mailto:${email}`}><Mail size={15} /> E-mail</a> : null}
        {client ? <button type="button" className="crmx-btn" onClick={() => onOpenClient(client.clientId)}><User size={15} /> Karta kupującego</button> : null}
        <button type="button" className="crmx-btn" onClick={() => onOpenOffer(deal.offerId)}><Home size={15} /> Oferta</button>
      </div>

      {deal.status === 'ACTIVE' || deal.status === 'PAUSED' ? (
        <button
          type="button"
          className="crmx-dealsheet__lost"
          disabled={busy}
          onClick={() => void dealAction('set_status', { status: 'LOST' }, 'Zamknięte — kupujący nie jest już zainteresowany.')}
        >
          Kupujący zrezygnował — zamknij
        </button>
      ) : null}
    </div>
  );
}
