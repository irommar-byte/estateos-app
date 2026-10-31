'use client';

import Link from 'next/link';
import {
  ArrowDownUp,
  Building2,
  CalendarClock,
  Check,
  ExternalLink,
  IdCard,
  KeyRound,
  Mail,
  Phone,
  Search,
  Sparkles,
  Target,
  UserPlus,
} from 'lucide-react';
import type { AgencyClientListItem } from '@/lib/agencyClientShape';
import { initials, pln, relative, stamp } from './format';

type Group = { key: string; primary: AgencyClientListItem; members: AgencyClientListItem[]; types: Array<'BUYER' | 'SELLER'>; ids: number[] };
export type ClientTypeFilter = 'ALL' | 'BUYER' | 'SELLER';

const ONLINE_MS = 10 * 60 * 1000;

function stageOf(c: AgencyClientListItem): { label: string; tone: string } {
  if (c.type === 'SELLER') {
    const s = String(c.linkedOfferStatus || '').toUpperCase();
    if (c.dealClosed || s === 'SOLD') return { label: 'Sprzedane', tone: 'good' };
    if (s === 'IN_DEAL') return { label: 'W transakcji', tone: 'gold' };
    if (s === 'ACTIVE' || s === 'PUBLISHED') return { label: 'Oferta na rynku', tone: 'good' };
    if (c.acquisitionSigned) return { label: 'Umowa podpisana', tone: 'info' };
    if (c.upcomingMeetingStartsAt) return { label: 'Spotkanie pozyskania', tone: 'warn' };
    return { label: 'Pozyskanie', tone: '' };
  }
  if (c.dealClosed) return { label: 'Transakcja zamknięta', tone: 'good' };
  if (c.presentationConfirmed) return { label: 'Prezentacje', tone: 'gold' };
  if ((c.sentCount || 0) > 0) return { label: 'Ogląda oferty', tone: 'info' };
  if (c.matchCount > 0) return { label: 'Dopasowania gotowe', tone: 'warn' };
  return { label: 'Szuka', tone: '' };
}

function meetingLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Dziś ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Jutro ${time}`;
  return `${d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

/** Lista klientów jako czytelne wizytówki: kim jest, czego chce, na jakim etapie, co dalej i z czym jest połączony. */
export default function CrmClientsList({
  groups,
  total,
  counts,
  typeFilter,
  onTypeFilter,
  query,
  onQuery,
  onlyAttention,
  onOnlyAttention,
  sortBy,
  onSortBy,
  selectedId,
  onOpen,
  selectedIds,
  onToggleSelect,
  onAdd,
  onSendCard,
  cardBusyId,
  compact,
}: {
  groups: Group[];
  total: number;
  counts: { ALL: number; BUYER: number; SELLER: number; attention: number };
  typeFilter: ClientTypeFilter;
  onTypeFilter: (v: ClientTypeFilter) => void;
  query: string;
  onQuery: (v: string) => void;
  onlyAttention: boolean;
  onOnlyAttention: (v: boolean) => void;
  sortBy: 'recent' | 'name' | 'match';
  onSortBy: (v: 'recent' | 'name' | 'match') => void;
  selectedId: number | null;
  onOpen: (id: number) => void;
  selectedIds: Set<number>;
  onToggleSelect: (ids: number[]) => void;
  onAdd: () => void;
  onSendCard: (id: number) => void;
  cardBusyId: number | null;
  compact: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="crmx-seg" role="group" aria-label="Rodzaj klienta">
          <button type="button" aria-pressed={typeFilter === 'ALL' && !onlyAttention} onClick={() => { onTypeFilter('ALL'); onOnlyAttention(false); }}>Wszyscy <small>{counts.ALL}</small></button>
          <button type="button" aria-pressed={typeFilter === 'BUYER' && !onlyAttention} onClick={() => { onTypeFilter('BUYER'); onOnlyAttention(false); }}>Kupujący <small>{counts.BUYER}</small></button>
          <button type="button" aria-pressed={typeFilter === 'SELLER' && !onlyAttention} onClick={() => { onTypeFilter('SELLER'); onOnlyAttention(false); }}>Sprzedający <small>{counts.SELLER}</small></button>
          {!compact ? (
            <button type="button" aria-pressed={onlyAttention} onClick={() => { onTypeFilter('ALL'); onOnlyAttention(!onlyAttention); }}>Wymaga uwagi <small>{counts.attention}</small></button>
          ) : null}
        </div>
        <label className="crmx-input" style={{ flex: '1 1 200px' }}>
          <Search />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Szukaj: imię, e-mail, telefon" />
        </label>
        {!compact ? (
          <>
            <label className="crmx-input">
              <ArrowDownUp />
              <select value={sortBy} onChange={(e) => onSortBy(e.target.value as 'recent' | 'name' | 'match')} aria-label="Sortowanie">
                <option value="recent">Ostatnia aktywność</option>
                <option value="name">Nazwisko A–Z</option>
                <option value="match">Najlepsze dopasowanie</option>
              </select>
            </label>
            <button type="button" className="crmx-btn crmx-btn--primary" onClick={onAdd}><UserPlus /> Dodaj klienta</button>
          </>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="crmx-card crmx-empty" style={{ padding: '44px 20px' }}>
          {total === 0 ? 'Nie masz jeszcze klientów. Dodaj pierwszego.' : 'Brak klientów w tym widoku.'}
        </div>
      ) : (
        <div className={`crmx-clients ${compact ? 'is-compact' : ''}`}>
          {groups.map((g) => {
            const c = g.primary;
            const name = `${c.firstName} ${c.lastName}`.trim();
            const buyer = g.members.find((m) => m.type === 'BUYER') || null;
            const seller = g.members.find((m) => m.type === 'SELLER') || null;
            const active = selectedId != null && g.ids.includes(selectedId);
            const checked = g.ids.every((id) => selectedIds.has(id));
            const online = c.linkedUserLastLoginAt && Date.now() - new Date(c.linkedUserLastLoginAt).getTime() < ONLINE_MS;
            const meeting = g.members.map((m) => m.upcomingMeetingStartsAt).filter(Boolean).sort()[0] || null;
            const stage = stageOf(seller || c);
            const buyerStage = buyer && seller ? stageOf(buyer) : null;
            const role = g.types.length > 1 ? 'Sprzedający i kupujący' : g.types[0] === 'SELLER' ? 'Sprzedający' : 'Kupujący';
            return (
              <article
                key={g.key}
                className={`crmx-client ${active ? 'is-active' : ''} ${checked ? 'is-checked' : ''}`}
                onClick={() => onOpen(c.id)}
              >
                <div className="crmx-client__id">
                  <button
                    type="button"
                    className={`crmx-check ${checked ? 'is-on' : ''}`}
                    aria-label={checked ? 'Odznacz klienta' : 'Zaznacz klienta'}
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(g.ids); }}
                  >
                    {checked ? <Check size={12} /> : null}
                  </button>
                  <span className={`crmx-client__avatar ${g.types.includes('SELLER') ? 'is-seller' : ''}`}>
                    {initials(name)}
                    {online ? <i className="crmx-client__online" title="Online teraz" /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className="crmx-client__name">{name}</p>
                    <p className="crmx-client__role">{role} · ID {c.id}{g.ids.length > 1 ? ` · ${g.ids.length} sprawy` : ''}</p>
                  </div>
                </div>

                <div className="crmx-client__contact">
                  <span className={`crmx-client__line ${c.phoneVerifiedAt ? 'is-ok' : ''}`}>
                    <Phone size={13} />{c.phone || 'brak telefonu'}{c.phoneVerifiedAt ? <Check size={12} className="ok" /> : null}
                  </span>
                  <span className={`crmx-client__line ${c.emailVerifiedAt ? 'is-ok' : ''}`}>
                    <Mail size={13} /><span className="truncate">{c.email || 'brak e-maila'}</span>{c.emailVerifiedAt ? <Check size={12} className="ok" /> : null}
                  </span>
                </div>

                <div className="crmx-client__want">
                  {seller ? (
                    <p>
                      <Building2 size={13} />
                      <span>Sprzedaje{seller.sellerCity ? ` · ${seller.sellerCity}` : ''}{seller.sellerPrice ? ` · ${pln(seller.sellerPrice)}` : ''}</span>
                    </p>
                  ) : null}
                  {buyer ? (
                    <p>
                      <Target size={13} />
                      <span>Szuka{buyer.buyerCity ? ` · ${buyer.buyerCity}` : ''}{buyer.buyerMaxPrice ? ` · do ${pln(buyer.buyerMaxPrice)}` : ''}</span>
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className={`crmx-chip ${stage.tone ? `crmx-chip--${stage.tone}` : ''}`}>{stage.label}</span>
                    {buyerStage ? <span className={`crmx-chip ${buyerStage.tone ? `crmx-chip--${buyerStage.tone}` : ''}`}>{buyerStage.label}</span> : null}
                  </div>
                </div>

                <div className="crmx-client__links">
                  {buyer ? (
                    <span className="crmx-chip" title="Dopasowane oferty · najlepszy wynik">
                      <Sparkles size={11} /> {buyer.matchCount} dopas.{buyer.topMatchScore ? ` · ${buyer.topMatchScore}%` : ''}
                    </span>
                  ) : null}
                  {buyer && (buyer.sentCount || 0) > 0 ? <span className="crmx-chip">{buyer.sentCount} wysłanych</span> : null}
                  {meeting ? (
                    <span className="crmx-chip crmx-chip--warn"><CalendarClock size={11} /> {meetingLabel(meeting)}</span>
                  ) : null}
                  {seller?.linkedOfferId ? (
                    <Link href={`/oferta/${seller.linkedOfferId}`} onClick={(e) => e.stopPropagation()} className="crmx-chip crmx-chip--gold">
                      <KeyRound size={11} /> Oferta #{seller.linkedOfferId}
                    </Link>
                  ) : null}
                  {c.linkedUserId ? <span className={`crmx-chip ${online ? 'crmx-chip--good' : ''}`}>{online ? 'Online teraz' : c.linkedUserLastLoginAt ? `Ostatnio online: ${stamp(c.linkedUserLastLoginAt)}` : 'Ma konto'}</span> : null}
                  {c.portalUrl ? (
                    <a href={c.portalUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="crmx-chip crmx-chip--info">
                      Panel klienta <ExternalLink size={10} />
                    </a>
                  ) : null}
                </div>

                <div className="crmx-client__actions" onClick={(e) => e.stopPropagation()}>
                  <span className="crmx-client__seen">{relative(c.updatedAt)}</span>
                  <div className="flex gap-1">
                    {c.phone ? <a href={`tel:${c.phone}`} className="crmx-btn crmx-btn--sm crmx-btn--icon" title="Zadzwoń"><Phone size={14} /></a> : null}
                    {c.email ? <a href={`mailto:${c.email}`} className="crmx-btn crmx-btn--sm crmx-btn--icon" title="E-mail"><Mail size={14} /></a> : null}
                    <button
                      type="button"
                      className="crmx-btn crmx-btn--sm crmx-btn--icon"
                      title={c.email ? 'Wyślij wizytówkę' : 'Brak e-maila klienta'}
                      disabled={!c.email || cardBusyId === c.id}
                      onClick={() => onSendCard(c.id)}
                    >
                      <IdCard size={14} />
                    </button>
                    <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--primary" onClick={() => onOpen(c.id)}>Otwórz</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
