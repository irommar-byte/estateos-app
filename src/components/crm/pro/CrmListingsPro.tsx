'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArchiveX,
  ArrowDownUp,
  ExternalLink,
  Eye,
  Heart,
  LayoutGrid,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Rows3,
  Search,
  Send,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { daysSince, pln, plnPerSqm, PROPERTY_LABEL, relative } from './format';

type Section = 'ACTIVE' | 'PENDING' | 'COMPLETED';
type Bid = { id: number | string; offerId?: number | string; dealId?: number | string; amount?: number | string; financing?: string; status?: string };

type Props = {
  mode: 'listings' | 'favorites';
  offers: any[];
  bids: Bid[];
  classify: (offer: any) => Section;
  isAwaitingReview: (offer: any) => boolean;
  focusOfferId?: number | null;
  onFocusConsumed?: () => void;
  onAdd: () => void;
  onRefresh: (offer: { id: string; title?: string }) => void;
  onArchive: (offer: any) => void;
  onComment: (offer: { id: number; title?: string }) => void;
  onTransfer: (offer: { id: number; title?: string }) => void;
  onBidResponse: (e: React.MouseEvent, bid: { id: number | string; dealId?: number | string }, decision: 'ACCEPT' | 'REJECT') => void;
  onPriceSaved?: (offerId: number, price: number) => void;
};

type SortKey = 'newest' | 'price_desc' | 'price_asc' | 'views' | 'buyers' | 'days';
const SORTS: Array<[SortKey, string]> = [
  ['newest', 'Najnowsze'],
  ['buyers', 'Najwięcej kupujących'],
  ['views', 'Największy zasięg'],
  ['price_desc', 'Cena: od najwyższej'],
  ['price_asc', 'Cena: od najniższej'],
  ['days', 'Najdłużej na rynku'],
];

const SECTION_LABEL: Record<Section, string> = { ACTIVE: 'Aktywne', PENDING: 'Oczekujące', COMPLETED: 'Zakończone' };
const VIEW_KEY = 'eos-crmx-listings-view';

function statusChip(offer: any, section: Section, awaiting: boolean) {
  if (awaiting) return <span className="crmx-chip crmx-chip--info"><span className="crmx-dot" />Akceptacja biura</span>;
  if (section === 'ACTIVE') return <span className="crmx-chip crmx-chip--good"><span className="crmx-dot" />Na rynku</span>;
  if (section === 'PENDING') return <span className="crmx-chip crmx-chip--warn"><span className="crmx-dot" />Oczekuje</span>;
  const s = String(offer.status || '');
  return <span className="crmx-chip"><span className="crmx-dot" />{s === 'SOLD' ? 'Sprzedana' : s === 'RENTED' ? 'Wynajęta' : 'Zakończona'}</span>;
}

function txChip(offer: any) {
  const rent = String(offer.transactionType) === 'RENT';
  return <span className={`crmx-chip ${rent ? 'crmx-chip--info' : 'crmx-chip--gold'}`}>{rent ? 'Wynajem' : 'Sprzedaż'}</span>;
}

function params(offer: any): string {
  const bits: string[] = [];
  if (Number(offer.area) > 0) bits.push(`${Number(offer.area).toLocaleString('pl-PL')} m²`);
  if (Number(offer.rooms) > 0) bits.push(`${offer.rooms} pok.`);
  if (offer.floor != null && offer.floor !== '') bits.push(`p. ${offer.floor}${offer.totalFloors ? `/${offer.totalFloors}` : ''}`);
  if (Number(offer.plotArea) > 0) bits.push(`dz. ${Number(offer.plotArea).toLocaleString('pl-PL')} m²`);
  return bits.join(' · ') || '—';
}

function address(offer: any): string {
  return [offer.street, offer.district, offer.city].filter(Boolean).join(', ');
}

/** Ogłoszenia agenta: tabela z filtrami i sortowaniem + szuflada ze wszystkimi informacjami i akcjami. */
export default function CrmListingsPro(props: Props) {
  const { mode, offers, bids, classify, isAwaitingReview } = props;
  const [section, setSection] = useState<Section | 'ALL'>(mode === 'favorites' ? 'ALL' : 'ACTIVE');
  const [query, setQuery] = useState('');
  const [tx, setTx] = useState<'ALL' | 'SELL' | 'RENT'>('ALL');
  const [type, setType] = useState<string>('ALL');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'grid' || v === 'table') setView(v);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (props.focusOfferId) {
      setOpenId(props.focusOfferId);
      setSection('ALL');
      props.onFocusConsumed?.();
    }
  }, [props.focusOfferId]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<Section, number> = { ACTIVE: 0, PENDING: 0, COMPLETED: 0 };
    for (const o of offers) c[classify(o)] += 1;
    return c;
  }, [offers, classify]);

  const types = useMemo(() => Array.from(new Set(offers.map((o) => String(o.propertyType || '')).filter(Boolean))), [offers]);

  const pendingBidsByOffer = useMemo(() => {
    const m = new Map<number, Bid[]>();
    for (const b of bids || []) {
      if (String(b.status || '').toUpperCase() !== 'PENDING') continue;
      const id = Number(b.offerId ?? (b as { deal?: { offerId?: number } }).deal?.offerId);
      if (!id) continue;
      m.set(id, [...(m.get(id) || []), b]);
    }
    return m;
  }, [bids]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = offers.filter((o) => {
      if (section !== 'ALL' && classify(o) !== section) return false;
      if (tx !== 'ALL' && String(o.transactionType) !== tx) return false;
      if (type !== 'ALL' && String(o.propertyType) !== type) return false;
      if (q) {
        const hay = `${o.title} ${o.street || ''} ${o.district || ''} ${o.city || ''} ${o.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const price = (o: any) => Number(o.pricePln || o.price || 0);
    const cmp: Record<SortKey, (a: any, b: any) => number> = {
      newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
      price_desc: (a, b) => price(b) - price(a),
      price_asc: (a, b) => price(a) - price(b),
      views: (a, b) => (b.views || 0) - (a.views || 0),
      buyers: (a, b) => (b.buyersInProcess || 0) + (b.sentToClients || 0) - ((a.buyersInProcess || 0) + (a.sentToClients || 0)),
      days: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    };
    return [...list].sort(cmp[sort]);
  }, [offers, section, tx, type, query, sort, classify]);

  const open = openId ? offers.find((o) => Number(o.id) === openId) : null;
  const setViewPersist = (v: 'table' | 'grid') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {mode === 'listings' ? (
          <div className="crmx-seg" role="group" aria-label="Status">
            {(['ACTIVE', 'PENDING', 'COMPLETED'] as Section[]).map((s) => (
              <button key={s} type="button" aria-pressed={section === s} onClick={() => setSection(s)}>
                {SECTION_LABEL[s]} <small>{counts[s]}</small>
              </button>
            ))}
            <button type="button" aria-pressed={section === 'ALL'} onClick={() => setSection('ALL')}>
              Wszystkie <small>{offers.length}</small>
            </button>
          </div>
        ) : null}
        <label className="crmx-input" style={{ flex: '1 1 220px', maxWidth: 360 }}>
          <Search />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj: tytuł, ulica, dzielnica, ID" />
        </label>
        <label className="crmx-input">
          <select value={tx} onChange={(e) => setTx(e.target.value as typeof tx)} aria-label="Transakcja">
            <option value="ALL">Sprzedaż i wynajem</option>
            <option value="SELL">Sprzedaż</option>
            <option value="RENT">Wynajem</option>
          </select>
        </label>
        {types.length > 1 ? (
          <label className="crmx-input">
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Rodzaj">
              <option value="ALL">Każdy rodzaj</option>
              {types.map((t) => (
                <option key={t} value={t}>{PROPERTY_LABEL[t] || t}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="crmx-input">
          <ArrowDownUp />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sortowanie">
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <div className="crmx-seg" role="group" aria-label="Widok">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setViewPersist('table')} title="Tabela"><Rows3 size={14} /></button>
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setViewPersist('grid')} title="Kafelki"><LayoutGrid size={14} /></button>
          </div>
          {mode === 'listings' ? (
            <button type="button" className="crmx-btn crmx-btn--primary" onClick={props.onAdd}>
              <Plus /> Dodaj ogłoszenie
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="crmx-card crmx-empty" style={{ padding: '48px 20px' }}>
          {mode === 'favorites' ? 'Nie masz jeszcze ulubionych ofert.' : 'Brak ogłoszeń w tym widoku.'}
        </div>
      ) : view === 'table' ? (
        <div className="crmx-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crmx-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>Oferta</th>
                  <th>Cena</th>
                  <th>Parametry</th>
                  <th>Status</th>
                  <th title="Unikalne wyświetlenia oferty"><Eye size={12} className="inline" /> Zasięg</th>
                  <th title="Kupujący w procesie · wysłana klientom"><Users size={12} className="inline" /> Kupujący</th>
                  <th aria-label="Akcje" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const id = Number(o.id);
                  const sec = classify(o);
                  const img = resolveOfferPrimaryImage(o);
                  const bidsN = pendingBidsByOffer.get(id)?.length || 0;
                  const days = daysSince(o.createdAt);
                  return (
                    <tr key={id} aria-selected={openId === id} onClick={() => setOpenId(id)}>
                      <td>
                        <div className="flex items-center gap-3">
                          {img ? <img src={img} alt="" className="crmx-thumb" style={{ width: 64, height: 48 }} /> : <span className="crmx-thumb" style={{ width: 64, height: 48 }} />}
                          <div className="min-w-0">
                            <p className="truncate font-semibold" style={{ maxWidth: 300 }}>{o.title}</p>
                            <p className="mt-0.5 truncate text-[12px] crmx-muted" style={{ maxWidth: 300 }}>{address(o) || '—'}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {txChip(o)}
                              {o.propertyType ? <span className="crmx-chip">{PROPERTY_LABEL[String(o.propertyType)] || o.propertyType}</span> : null}
                              {bidsN ? <span className="crmx-chip crmx-chip--bad">{bidsN} {bidsN === 1 ? 'oferta cenowa' : 'oferty cenowe'}</span> : null}
                              <span className="crmx-chip crmx-muted">#{id}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="crmx-price">{pln(o.price, o.priceCurrency)}</p>
                        <p className="crmx-num text-[11.5px] crmx-muted">{plnPerSqm(o.pricePln || o.price, o.area) || ''}</p>
                      </td>
                      <td className="crmx-num text-[12.5px]">{params(o)}</td>
                      <td>
                        {statusChip(o, sec, isAwaitingReview(o))}
                        <p className="mt-1 text-[11px] crmx-muted crmx-num">{days == null ? '' : days === 0 ? 'dodane dziś' : `${days} dni na rynku`}</p>
                      </td>
                      <td className="crmx-num">{o.views || 0}</td>
                      <td className="crmx-num">
                        <b>{o.buyersInProcess || 0}</b>
                        <span className="crmx-muted"> · {o.sentToClients || 0} wysł.</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {mode === 'listings' ? (
                            <Link href={`/edytuj-oferte/${id}`} className="crmx-btn crmx-btn--sm crmx-btn--icon" title="Edytuj"><Pencil size={14} /></Link>
                          ) : null}
                          <Link href={`/oferta/${id}`} className="crmx-btn crmx-btn--sm crmx-btn--icon" title="Zobacz na stronie"><ExternalLink size={14} /></Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((o) => {
            const id = Number(o.id);
            const img = resolveOfferPrimaryImage(o);
            return (
              <button key={id} type="button" onClick={() => setOpenId(id)} className="crmx-card overflow-hidden text-left transition hover:-translate-y-0.5">
                <div className="relative" style={{ aspectRatio: '4 / 3', background: 'var(--x-surface-2)' }}>
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                  <div className="absolute left-3 top-3 flex gap-1">{txChip(o)}{statusChip(o, classify(o), isAwaitingReview(o))}</div>
                </div>
                <div className="p-4">
                  <p className="crmx-display" style={{ fontSize: 22 }}>{pln(o.price, o.priceCurrency)}</p>
                  <p className="mt-1 line-clamp-1 font-semibold">{o.title}</p>
                  <p className="line-clamp-1 text-[12px] crmx-muted">{address(o)}</p>
                  <p className="mt-2 text-[12px] crmx-num">{params(o)}</p>
                  <div className="mt-3 flex gap-3 text-[12px] crmx-muted crmx-num">
                    <span><Eye size={12} className="inline" /> {o.views || 0}</span>
                    <span><Users size={12} className="inline" /> {o.buyersInProcess || 0}</span>
                    <span><Send size={12} className="inline" /> {o.sentToClients || 0}</span>
                    <span><Heart size={12} className="inline" /> {o.favorites || 0}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {typeof document !== 'undefined' ? createPortal(
      <div className="crmx">
      <AnimatePresence>
        {open ? (
          <ListingDrawer
            {...props}
            key={Number(open.id)}
            offer={open}
            mode={mode}
            section={classify(open)}
            awaiting={isAwaitingReview(open)}
            bids={pendingBidsByOffer.get(Number(open.id)) || []}
            onClose={() => setOpenId(null)}
          />
        ) : null}
      </AnimatePresence>
      </div>,
      document.body,
      ) : null}
    </div>
  );
}

function ListingDrawer({
  offer,
  mode,
  section,
  awaiting,
  bids,
  onClose,
  onRefresh,
  onArchive,
  onComment,
  onTransfer,
  onBidResponse,
  onPriceSaved,
}: Props & { offer: any; section: Section; awaiting: boolean; bids: Bid[]; onClose: () => void }) {
  const id = Number(offer.id);
  const img = resolveOfferPrimaryImage(offer);
  const [price, setPrice] = useState(String(offer.price ?? ''));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const savePrice = async () => {
    const parsed = Number(price.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
    if (!(parsed > 0)) return setMsg('Podaj poprawną cenę');
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/offers/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(String(data?.error || 'Nie udało się zapisać'));
      onPriceSaved?.(id, parsed);
      setMsg('Zapisano');
    } catch {
      setMsg('Błąd sieci');
    } finally {
      setSaving(false);
    }
  };

  const facts: Array<[string, string]> = [
    ['Powierzchnia', Number(offer.area) > 0 ? `${Number(offer.area).toLocaleString('pl-PL')} m²` : '—'],
    ['Pokoje', offer.rooms ? String(offer.rooms) : '—'],
    ['Piętro', offer.floor != null ? `${offer.floor}${offer.totalFloors ? ` z ${offer.totalFloors}` : ''}` : '—'],
    ['Rok budowy', offer.yearBuilt ? String(offer.yearBuilt) : '—'],
    ['Rodzaj', PROPERTY_LABEL[String(offer.propertyType)] || String(offer.propertyType || '—')],
    ['Cena za m²', plnPerSqm(offer.pricePln || offer.price, offer.area) || '—'],
    ['Zasięg', String(offer.views || 0)],
    ['Ulubione', String(offer.favorites || 0)],
    ['Dodano', relative(offer.createdAt) || '—'],
  ];
  const amenities = [
    offer.hasBalcony && 'Balkon',
    offer.hasElevator && 'Winda',
    offer.hasParking && 'Parking',
    offer.hasGarden && 'Ogród',
    offer.floorPlanUrl && 'Rzut',
    offer.floorPlan3dUrl && 'Model 3D',
    offer.videoUrl && 'Wideo',
  ].filter(Boolean) as string[];

  return (
    <>
      <motion.div className="crmx-drawer-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside
        className="crmx crmx-drawer"
        role="dialog"
        aria-label={offer.title}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="crmx-drawer__hero">
          {img ? <img src={img} alt="" /> : null}
          <button type="button" className="crmx-drawer__close" onClick={onClose} aria-label="Zamknij"><X size={18} /></button>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <div className="flex flex-wrap gap-1.5">
              {txChip(offer)}
              {statusChip(offer, section, awaiting)}
              <span className="crmx-chip">#{id}</span>
            </div>
            <h2 className="crmx-display crmx-h2 mt-3">{offer.title}</h2>
            <p className="crmx-sub mt-1">{address(offer)}</p>
            <p className="crmx-display mt-3" style={{ fontSize: 30 }}>{pln(offer.price, offer.priceCurrency)}</p>
          </div>

          <dl className="crmx-facts">
            {facts.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>

          {amenities.length ? (
            <div className="flex flex-wrap gap-1.5">{amenities.map((a) => <span key={a} className="crmx-chip">{a}</span>)}</div>
          ) : null}

          {mode === 'listings' ? (
            <div className="crmx-strip">
              <div><b>{offer.buyersInProcess || 0}</b><span>Kupujący w procesie</span></div>
              <div><b>{offer.sentToClients || 0}</b><span>Wysłana klientom</span></div>
              <div><b>{bids.length}</b><span>Oferty cenowe</span></div>
            </div>
          ) : null}

          {bids.length ? (
            <section className="crmx-card">
              <header className="crmx-card__head"><h3 className="crmx-card__title">Oferty cenowe do decyzji</h3></header>
              <div className="crmx-list">
                {bids.map((b) => (
                  <div key={String(b.id)} className="crmx-row">
                    <span className="crmx-row__main">
                      <span className="crmx-row__title block">{pln(b.amount)}</span>
                      <span className="crmx-row__sub block">{b.financing || 'Finansowanie nieokreślone'}</span>
                    </span>
                    <button type="button" className="crmx-btn crmx-btn--sm" onClick={(e) => onBidResponse(e, b, 'REJECT')}>Odrzuć</button>
                    <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--primary" onClick={(e) => onBidResponse(e, b, 'ACCEPT')}>Przyjmij</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {mode === 'listings' && section !== 'COMPLETED' ? (
            <div>
              <p className="crmx-kpi__label mb-2">Szybka zmiana ceny</p>
              <div className="flex gap-2">
                <label className="crmx-input flex-1">
                  <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                  <span className="crmx-muted text-[12px]">{offer.priceCurrency || 'PLN'}</span>
                </label>
                <button type="button" className="crmx-btn crmx-btn--primary" disabled={saving} onClick={savePrice}>{saving ? 'Zapisuję…' : 'Zapisz'}</button>
              </div>
              {msg ? <p className="mt-1.5 text-[12px] crmx-muted">{msg}</p> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {mode === 'listings' ? (
              <Link href={`/edytuj-oferte/${id}`} className="crmx-btn crmx-btn--primary"><Pencil /> Edytuj ogłoszenie</Link>
            ) : null}
            <Link href={`/oferta/${id}`} className="crmx-btn"><ExternalLink /> Zobacz na stronie</Link>
            {mode === 'listings' ? (
              <>
                <button type="button" className="crmx-btn" onClick={() => onComment({ id, title: String(offer.title || '') })}><MessageSquarePlus /> Notatka</button>
                <button type="button" className="crmx-btn" onClick={() => onTransfer({ id, title: String(offer.title || '') })}><Share2 /> Przekaż</button>
                {section === 'COMPLETED' ? (
                  <button type="button" className="crmx-btn" onClick={() => onRefresh({ id: String(id), title: offer.title })}><RefreshCcw /> Wznów</button>
                ) : (
                  <button type="button" className="crmx-btn" style={{ color: 'var(--x-bad)' }} onClick={() => onArchive(offer)}><ArchiveX /> Wstrzymaj</button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
