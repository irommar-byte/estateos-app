'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CalendarClock, RotateCcw, Trash2, Check, ExternalLink, Mail, Maximize2, Phone, User, X, Home, MessageSquareQuote } from 'lucide-react';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { buyerName, STAGE_SHORT, type ProDeal, type ProGuide } from './CrmPulpit';
import { pln, relative, stamp } from './format';
import CrmDealClosing, { DealDocumentsPanel } from './CrmDealClosing';

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

/** Etapy po uzgodnieniu chęci kupna — prowadzone w module domknięcia (negocjacje → akt). */
const CLOSING_STAGES = new Set(['negotiation', 'reserved', 'preliminary', 'deed', 'closed']);

type View = { kind: 'deal'; id: number } | { kind: 'offer'; id: number } | { kind: 'client'; id: number } | { kind: 'docs'; id: number; name: string };

/**
 * Jedno okno boczne z nawigacją: transakcja → oferta → klient → kolejna transakcja…
 * Każde kliknięcie podmienia zawartość okna, „Wstecz” wraca krok po kroku.
 * „Pełny widok” to osobna funkcja — przenosi do odpowiedniego działu CRM.
 */
export default function CrmDealSheet({
  deal,
  deals,
  offers,
  onClose,
  onOpenClient,
  onOpenOffer,
}: {
  deal: ProDeal | null;
  deals: ProDeal[];
  offers?: any[];
  onClose: () => void;
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  const [stack, setStack] = useState<View[]>([]);
  const scroller = useRef<HTMLElement | null>(null);
  const titles = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setStack(deal ? [{ kind: 'deal', id: deal.id }] : []);
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = stack[stack.length - 1] || null;
  const push = (view: View) => {
    setStack((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === view.kind && last.id === view.id) return prev;
      return [...prev, view];
    });
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const back = () => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    if (scroller.current) scroller.current.scrollTop = 0;
  };

  useEffect(() => {
    if (!deal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deal, onClose]);

  const key = (v: View) => `${v.kind}:${v.id}`;
  const prev = stack.length > 1 ? stack[stack.length - 2] : null;
  const prevTitle = prev ? titles.current.get(key(prev)) || (prev.kind === 'deal' ? 'Transakcja' : prev.kind === 'offer' ? 'Oferta' : prev.kind === 'docs' ? 'Dokumenty' : 'Klient') : null;
  const setTitle = (v: View, t: string) => titles.current.set(key(v), t);

  const nav = {
    openClient: (id: number) => push({ kind: 'client', id }),
    openOffer: (id: number) => push({ kind: 'offer', id }),
    openDeal: (id: number) => push({ kind: 'deal', id }),
    openDocs: (id: number, name: string) => push({ kind: 'docs', id, name }),
  };

  let body: React.ReactNode = null;
  let full: (() => void) | null = null;
  if (top?.kind === 'deal') {
    const d = deals.find((x) => x.id === top.id) || (deal && deal.id === top.id ? deal : null);
    if (d) {
      setTitle(top, buyerName(d));
      body = <SheetBody key={key(top)} deal={d} onOpenClient={nav.openClient} onOpenOffer={nav.openOffer} onOpenDocs={nav.openDocs} />;
    }
  } else if (top?.kind === 'offer') {
    const offer = (offers || []).find((o) => Number(o.id) === top.id) || null;
    const fallback = deals.find((x) => x.offerId === top.id)?.offer || null;
    setTitle(top, offer?.title || fallback?.title || `Oferta #${top.id}`);
    full = () => onOpenOffer(top.id);
    body = <OfferPanel key={key(top)} offerId={top.id} offer={offer} fallback={fallback} deals={deals} onOpenDeal={nav.openDeal} onOpenClient={nav.openClient} />;
  } else if (top?.kind === 'docs') {
    setTitle(top, `Dokumenty · ${top.name}`);
    full = () => onOpenClient(top.id);
    body = <DealDocumentsPanel key={key(top)} clientId={top.id} name={top.name} />;
  } else if (top?.kind === 'client') {
    full = () => onOpenClient(top.id);
    body = <ClientPanel key={key(top)} clientId={top.id} deals={deals} onOpenDeal={nav.openDeal} onOpenOffer={nav.openOffer} onTitle={(t) => setTitle(top, t)} />;
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {deal ? (
        <>
          <motion.div key="scrim" className="crmx-drawer-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            key="sheet"
            ref={scroller as React.Ref<HTMLElement>}
            className="crmx crmx-drawer"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="crmx-panelbar">
              {prev ? (
                <button type="button" className="crmx-panelbar__back" onClick={back}>
                  <ArrowLeft size={16} />
                  <span className="truncate">{prevTitle}</span>
                </button>
              ) : (
                <span className="crmx-panelbar__crumb">Transakcja</span>
              )}
              <span className="flex-1" />
              {full ? (
                <button type="button" className="crmx-panelbar__btn" onClick={full} title="Otwórz w pełnym widoku CRM">
                  <Maximize2 size={14} /> Pełny widok
                </button>
              ) : null}
              <button type="button" className="crmx-panelbar__close" onClick={onClose} aria-label="Zamknij"><X size={17} /></button>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={top ? key(top) : 'none'}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.18 }}
              >
                {body}
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ───────────── Oferta w oknie ───────────── */

const PROPERTY_LABEL: Record<string, string> = { FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal', PREMISES: 'Lokal' };

function OfferPanel({
  offerId,
  offer,
  fallback,
  deals,
  onOpenDeal,
  onOpenClient,
}: {
  offerId: number;
  offer: any | null;
  fallback: ProDeal['offer'] | null;
  deals: ProDeal[];
  onOpenDeal: (id: number) => void;
  onOpenClient: (id: number) => void;
}) {
  const img = offer ? resolveOfferPrimaryImage(offer) : fallback?.imageUrl || null;
  const title = offer?.title || fallback?.title || `Oferta #${offerId}`;
  const addr = offer ? [offer.street, offer.district !== 'OTHER' ? offer.district : null, offer.city].filter(Boolean).join(', ') : fallback?.address || '';
  const price = offer?.price ?? fallback?.price ?? null;
  const buyers = deals.filter((d) => d.offerId === offerId && !d.archived && (d.status === 'ACTIVE' || d.status === 'PAUSED'));
  const seller = deals.find((d) => d.offerId === offerId && d.seller)?.seller || null;
  const facts: Array<[string, string]> = offer
    ? [
        ['Powierzchnia', Number(offer.area) > 0 ? `${Number(offer.area).toLocaleString('pl-PL')} m²` : '—'],
        ['Pokoje', offer.rooms ? String(offer.rooms) : '—'],
        ['Piętro', offer.floor != null ? `${offer.floor}${offer.totalFloors ? ` z ${offer.totalFloors}` : ''}` : '—'],
        ['Rodzaj', PROPERTY_LABEL[String(offer.propertyType)] || String(offer.propertyType || '—')],
        ['Wyświetlenia', String(offer.views || 0)],
        ['Ulubione', String(offer.favorites || 0)],
      ]
    : [];
  return (
    <div className="crmx-dealsheet">
      <div className="crmx-panelhero">{img ? <img src={img} alt="" /> : null}</div>
      <div>
        <p className="crmx-eyebrow">Oferta #{offerId}</p>
        <h3 className="crmx-dealsheet__title">{pln(price)}</h3>
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12.5px] crmx-muted">{addr}</p>
      </div>
      {facts.length ? (
        <div className="crmx-facts">
          {facts.map(([k, v]) => (
            <div key={k}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
      ) : null}
      {seller ? (
        <button type="button" className="crmx-linkrow" onClick={() => onOpenClient(seller.clientId)}>
          <User size={15} />
          <span className="flex-1 truncate"><span className="crmx-muted">Właściciel · </span>{seller.name}</span>
          <span className="crmx-muted">›</span>
        </button>
      ) : null}
      <section className="space-y-2">
        <p className="crmx-eyebrow">Kupujący przy tej ofercie · {buyers.length}</p>
        {buyers.length === 0 ? <p className="crmx-dealsheet__hint">Nikt nie jest jeszcze w procesie.</p> : null}
        {buyers.map((d) => (
          <button key={d.id} type="button" className="crmx-linkrow" onClick={() => onOpenDeal(d.id)}>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-semibold">{buyerName(d)}</span>
              <span className="block truncate text-[11.5px] crmx-muted">{d.guide?.headline || d.nextAction}</span>
            </span>
            <span className="crmx-chip">{STAGE_SHORT[d.stage] || d.stage}</span>
          </button>
        ))}
      </section>
      <a className="crmx-btn" href={`/oferta/${offerId}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ogłoszenie na stronie</a>
    </div>
  );
}

/* ───────────── Klient w oknie ───────────── */

type LiteClient = {
  id: number;
  type: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  sellerCity?: string | null;
  sellerPrice?: number | null;
  linkedOfferId?: number | null;
  portalUrl?: string | null;
  buyerPreference?: { city?: string | null; minPrice?: number | null; maxPrice?: number | null; minArea?: number | null; minRooms?: number | null } | null;
};

function ClientPanel({
  clientId,
  deals,
  onOpenDeal,
  onOpenOffer,
  onTitle,
}: {
  clientId: number;
  deals: ProDeal[];
  onOpenDeal: (id: number) => void;
  onOpenOffer: (id: number) => void;
  onTitle: (t: string) => void;
}) {
  const [client, setClient] = useState<LiteClient | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/crm/clients/${clientId}?lite=1`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.client) {
          setClient(j.client);
          onTitle(`${j.client.firstName} ${j.client.lastName}`.trim());
        } else setErr(String(j?.error || 'Nie udało się wczytać klienta.'));
      })
      .catch(() => alive && setErr('Nie udało się wczytać klienta.'));
    return () => {
      alive = false;
    };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = deals.filter((d) => (d.buyer.kind === 'client' && d.buyer.clientId === clientId) || d.seller?.clientId === clientId);
  if (err) return <div className="crmx-dealsheet"><p className="crmx-dealsheet__msg is-bad">{err}</p></div>;
  if (!client) return <div className="crmx-dealsheet"><p className="crmx-dealsheet__hint">Wczytywanie…</p></div>;
  const isSeller = client.type === 'SELLER';
  const pref = client.buyerPreference;
  const prefLine = pref
    ? [pref.city, pref.minPrice || pref.maxPrice ? `${pref.minPrice ? pln(pref.minPrice) : '…'} – ${pref.maxPrice ? pln(pref.maxPrice) : '…'}` : null, pref.minArea ? `od ${pref.minArea} m²` : null, pref.minRooms ? `od ${pref.minRooms} pok.` : null]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <div className="crmx-dealsheet">
      <div>
        <p className="crmx-eyebrow">{isSeller ? 'Sprzedający · właściciel' : 'Kupujący'}</p>
        <h3 className="crmx-dealsheet__title">{client.firstName} {client.lastName}</h3>
      </div>
      <div className="crmx-person">
        <p className="crmx-person__line">{client.phone || 'brak telefonu'}{client.email ? ` · ${client.email}` : ''}</p>
        <div className="crmx-dealsheet__row">
          {client.phone ? <a className="crmx-btn crmx-btn--gold" href={`tel:${client.phone}`}><Phone size={15} /> Zadzwoń</a> : null}
          {client.email ? <a className="crmx-btn" href={`mailto:${client.email}`}><Mail size={15} /> E-mail</a> : null}
          {client.portalUrl ? <a className="crmx-btn" href={client.portalUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Panel klienta</a> : null}
        </div>
      </div>
      {isSeller && client.linkedOfferId ? (
        <button type="button" className="crmx-linkrow" onClick={() => onOpenOffer(Number(client.linkedOfferId))}>
          <Home size={15} />
          <span className="flex-1 truncate"><span className="crmx-muted">Jego oferta · </span>#{client.linkedOfferId}{client.sellerPrice ? ` · ${pln(client.sellerPrice)}` : ''}</span>
          <span className="crmx-muted">›</span>
        </button>
      ) : null}
      {!isSeller && prefLine ? (
        <div className="crmx-person"><p className="crmx-eyebrow">Czego szuka</p><p className="crmx-person__line">{prefLine}</p></div>
      ) : null}
      {client.notes ? (
        <div className="crmx-person"><p className="crmx-eyebrow">Notatki</p><p className="crmx-person__line" style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</p></div>
      ) : null}
      <section className="space-y-2">
        <p className="crmx-eyebrow">{isSeller ? 'Kupujący przy jego ofercie' : 'Nieruchomości w procesie'} · {related.length}</p>
        {related.length === 0 ? <p className="crmx-dealsheet__hint">Brak transakcji w toku.</p> : null}
        {related.map((d) => (
          <button key={d.id} type="button" className="crmx-linkrow" onClick={() => onOpenDeal(d.id)}>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-semibold">{isSeller ? buyerName(d) : d.offer.title}</span>
              <span className="block truncate text-[11.5px] crmx-muted">{d.guide?.headline || d.nextAction}</span>
            </span>
            <span className="crmx-chip">{STAGE_SHORT[d.stage] || d.stage}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

function SheetBody({
  deal,
  onOpenClient,
  onOpenOffer,
  onOpenDocs,
}: {
  deal: ProDeal;
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
  onOpenDocs: (clientId: number, name: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [slots, setSlots] = useState<string[]>([localInput(1, 17), localInput(2, 11), '']);
  const [agreed, setAgreed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [intentNote, setIntentNote] = useState('');
  const [confirmLost, setConfirmLost] = useState(false);
  const [searchOther, setSearchOther] = useState(false);
  const [searchNote, setSearchNote] = useState('');

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

  const guide = deal.guide || null;
  const sellerCard = deal.seller ? (
    <div className="crmx-dealsheet__people">
      <div className="crmx-person">
        <p className="crmx-eyebrow">Właściciel</p>
        <p className="crmx-person__name">{deal.seller.name}</p>
        <p className="crmx-person__line">{deal.seller.phone || 'brak telefonu'}{deal.seller.email ? ` · ${deal.seller.email}` : ''}</p>
        <div className="crmx-dealsheet__row">
          {deal.seller.phone ? <a className="crmx-btn crmx-btn--gold" href={`tel:${deal.seller.phone}`}><Phone size={15} /> Zadzwoń</a> : null}
          {deal.seller.email ? <a className="crmx-btn" href={`mailto:${deal.seller.email}`}><Mail size={15} /> E-mail</a> : null}
          <button type="button" className="crmx-btn" onClick={() => onOpenClient(deal.seller!.clientId)}><User size={15} /> Karta właściciela</button>
        </div>
      </div>
      <button type="button" className="crmx-offerpeek" onClick={() => onOpenOffer(deal.offerId)}>
        {deal.offer.imageUrl ? <img src={deal.offer.imageUrl} alt="" /> : <span className="crmx-offerpeek__ph" />}
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{deal.offer.title}</span>
          <span className="block truncate text-[11.5px] crmx-muted">{deal.offer.address}</span>
          <span className="block text-[12px] font-semibold crmx-num">{pln(deal.offer.price)}</span>
        </span>
      </button>
    </div>
  ) : null;
  const buyerCard = (
    <div className="crmx-person">
      <p className="crmx-eyebrow">Kupujący</p>
      <p className="crmx-person__name">{buyerName(deal)}{deal.buyer.kind === 'external' && deal.buyer.agency ? ` · ${deal.buyer.agency}` : ''}</p>
      <p className="crmx-person__line">{phone || 'brak telefonu'}{email ? ` · ${email}` : ''}</p>
      <div className="crmx-dealsheet__row">
        {phone ? <a className="crmx-btn crmx-btn--gold" href={`tel:${phone}`}><Phone size={15} /> Zadzwoń</a> : null}
        {email ? <a className="crmx-btn" href={`mailto:${email}`}><Mail size={15} /> E-mail</a> : null}
      </div>
    </div>
  );
  const guideAction = (action: ProGuide['steps'][number]['action']) => {
    if (action === 'confirm_intent') {
      return (
        <div className="crmx-dealsheet__form">
          <label className="crmx-input">
            <CalendarClock />
            <input value={intentNote} onChange={(e) => setIntentNote(e.target.value)} placeholder="Kiedy mu pasuje? np. wt–czw po 17" />
          </label>
          <div className="crmx-dealsheet__row">
            <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void dealAction('confirm_intent', { note: intentNote }, 'Zapisane — teraz ustal termin z właścicielem.')}>
              <Check size={15} /> Chce obejrzeć
            </button>
            <button type="button" className="crmx-btn crmx-btn--danger-soft" disabled={busy} onClick={() => { setConfirmLost(true); window.setTimeout(() => document.querySelector('.crmx-danger')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>
              Nie jest zainteresowany
            </button>
          </div>
        </div>
      );
    }
    if (action === 'schedule') return scheduleForm;
    if (action === 'accept_client_slot') {
      return (
        <div className="crmx-dealsheet__form">
          <p className="crmx-dealsheet__hint">Termin od kupującego: <b>{pres ? when(pres.startsAt) : '—'}</b></p>
          <button
            type="button"
            className="crmx-btn crmx-btn--gold"
            disabled={busy || !client}
            onClick={() => client && void run(`/api/crm/clients/${client.clientId}`, { action: 'accept_schedule_change', kind: 'presentation' }, 'Termin potwierdzony — prezentacja umówiona.')}
          >
            <Check size={15} /> Właściciel może — potwierdź
          </button>
          <button type="button" className="crmx-btn" onClick={() => setFormOpen((v) => !v)}>Zaproponuj inne terminy</button>
          {formOpen ? scheduleForm : null}
        </div>
      );
    }
    if (action === 'remind_buyer') {
      return (
        <div className="crmx-dealsheet__form">
          <p className="crmx-dealsheet__hint">Wysłane terminy: {(pres?.proposedSlots || (pres ? [pres.startsAt] : [])).map(when).join(' · ') || '—'}</p>
          <button type="button" className="crmx-btn" onClick={() => setFormOpen((v) => !v)}>Zmień terminy</button>
          {formOpen ? scheduleForm : null}
        </div>
      );
    }
    return null;
  };

  let step: { title: string; body: React.ReactNode } | null = null;
  const frozen = Boolean(deal.archived);
  if ((deal.status === 'ACTIVE' || deal.status === 'PAUSED') && !guide && !frozen) {
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
    }
  }
  const closing = CLOSING_STAGES.has(stage);

  return (
    <div className="crmx-dealsheet">
      <div className="crmx-dealsheet__head">
        {deal.offer.imageUrl ? <img src={deal.offer.imageUrl} alt="" className="crmx-thumb" style={{ width: 52, height: 52, borderRadius: 12 }} /> : <span className="crmx-thumb" style={{ width: 52, height: 52 }} />}
        <div className="min-w-0 flex-1">
          <p className="crmx-eyebrow">{STAGE_SHORT[stage] || stage}</p>
          <h3 className="crmx-dealsheet__title">{buyerName(deal)}</h3>
          <p className="truncate text-[12.5px] crmx-muted">{deal.offer.title} · {pln(deal.offer.price)}</p>
        </div>
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

      {frozen && deal.archived ? (
        <section className="crmx-card crmx-dealsheet__guide">
          <p className="crmx-eyebrow">{deal.archived.action === 'pause' ? 'Wstrzymana · klient w archiwum' : 'Zamknięta · klient w archiwum'}</p>
          <p className="mt-1 text-[13.5px]">
            {deal.archived.clientName} trafił do archiwum {stamp(deal.archived.at)}.{' '}
            {deal.archived.action === 'pause'
              ? 'Ta transakcja czeka w miejscu, w którym była — wróci do lejka, gdy administrator przywróci klienta.'
              : 'Transakcję zamknięto razem z archiwizacją klienta. Historia zostaje poniżej.'}
          </p>
        </section>
      ) : null}

      {guide && !frozen ? (
        <section className="crmx-card crmx-dealsheet__guide">
          <p className="crmx-eyebrow">{guide.intent === 'unclear' ? 'Sytuacja · do wyjaśnienia' : 'Sytuacja'}</p>
          <h4 className="crmx-dealsheet__steptitle">{guide.headline}</h4>
          <p className="crmx-dealsheet__hint">{guide.story}</p>
          {guide.lastMessage ? (
            <blockquote className="crmx-dealsheet__quote">
              <MessageSquareQuote size={15} />
              <span>{guide.lastMessage.text}{guide.lastMessage.at ? <span className="crmx-muted"> · {relative(guide.lastMessage.at)}</span> : null}</span>
            </blockquote>
          ) : null}
          <ol className="crmx-dealsheet__steps">
            {guide.steps.map((g, i) => (
              <li key={i}>
                <span className="crmx-dealsheet__num">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <p className="text-[14px] font-semibold">{g.title}</p>
                    <p className="crmx-dealsheet__hint">{g.detail}</p>
                  </div>
                  {g.contact === 'seller' ? sellerCard : g.contact === 'buyer' ? buyerCard : null}
                  {guideAction(g.action)}
                </div>
              </li>
            ))}
          </ol>
          {msg ? <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
        </section>
      ) : null}

      {closing ? <CrmDealClosing deal={deal} onOpenDocs={onOpenDocs} /> : null}

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

      {(deal.status === 'ACTIVE' || deal.status === 'PAUSED') && !frozen ? (
        confirmLost ? (
          <section className="crmx-danger" role="alertdialog" aria-label="Potwierdź zamknięcie">
            <p className="crmx-danger__title"><AlertTriangle size={17} /> Na pewno zamknąć transakcję: {buyerName(deal)}?</p>
            <ul className="crmx-danger__list">
              <li>Kupujący <b>zniknie z lejka</b> i ze wszystkich kolumn — trafi do „Zakończone”.</li>
              <li>Przepadną przypomnienia i podpowiedzi następnych kroków dla tej oferty.</li>
              <li>Ani kupujący, ani właściciel nie dostaną żadnej wiadomości.</li>
              <li>Historia zostaje zapisana. Przez 90 dni możesz przywrócić go z „Zakończone”, potem przestanie być widoczny.</li>
            </ul>
            {client ? (
              <label className="crmx-dealsheet__check">
                <input type="checkbox" checked={searchOther} onChange={(e) => setSearchOther(e.target.checked)} />
                Szukamy dla niego czegoś innego
              </label>
            ) : null}
            {client && searchOther ? (
              <label className="crmx-input">
                <input value={searchNote} onChange={(e) => setSearchNote(e.target.value)} placeholder="Co mu nie pasowało / czego szukać? (trafi do notatek)" />
              </label>
            ) : null}
            <div className="crmx-dealsheet__row">
              <button
                type="button"
                className="crmx-btn crmx-btn--danger"
                disabled={busy}
                onClick={() =>
                  void dealAction(
                    'set_status',
                    { status: 'LOST', ...(client ? { searchOther, searchNote: searchOther ? searchNote : null } : {}) },
                    'Zamknięte — przeniesione do „Zakończone”.',
                  ).then(() => setConfirmLost(false))
                }
              >
                <Trash2 size={15} /> Tak, zamknij transakcję
              </button>
              <button type="button" className="crmx-btn" onClick={() => setConfirmLost(false)}>Anuluj — zostaw w lejku</button>
            </div>
          </section>
        ) : (
          <button type="button" className="crmx-dealsheet__lost" disabled={busy} onClick={() => { setConfirmLost(true); window.setTimeout(() => document.querySelector('.crmx-danger')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>
            <Trash2 size={14} /> Kupujący zrezygnował — zamknij transakcję
          </button>
        )
      ) : deal.status === 'LOST' ? (
        <button type="button" className="crmx-btn" disabled={busy} onClick={() => void dealAction('set_status', { status: 'ACTIVE' }, 'Przywrócone do lejka — wraca na swój etap.')}>
          <RotateCcw size={15} /> Przywróć do lejka
        </button>
      ) : null}
      {msg && !deal.guide && !(deal.status === 'ACTIVE' || deal.status === 'PAUSED') ? <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
    </div>
  );
}
