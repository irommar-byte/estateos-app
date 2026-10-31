'use client';

import { useEffect, useState } from 'react';
import { Check, CircleDollarSign, FileText, FolderOpen, KeyRound, Lock, Phone, RotateCcw, Scale, Send, Trash2, X } from 'lucide-react';
import type { ProDeal } from './CrmPulpit';
import { pln } from './format';

/**
 * Domknięcie transakcji w oknie lejka: negocjacje ceny, rezerwacja, umowa → akt → klucze → prowizja i dokumenty.
 * Ten sam przepływ co karta kupującego w aplikacji — wyjaśnienie sytuacji, kroki i przyciski.
 */

type Offer = NonNullable<ProDeal['negotiation']>['offers'][number];
type StepId = 'preliminary' | 'deed' | 'handover' | 'commission';
type Act = (body: Record<string, unknown>, ok: string) => Promise<{ ok: boolean; otherActive?: number }>;

const SIDE = { buyer: 'Kupujący', seller: 'Sprzedający' } as const;
const RESPONSE = { accept: 'przyjmuje', reject: 'odrzuca', counter: 'proponuje' } as const;
const OFFER_STATUS: Record<Offer['status'], { label: string; tone: string }> = {
  open: { label: 'czeka', tone: 'crmx-chip--info' },
  accepted: { label: 'przyjęta', tone: 'crmx-chip--good' },
  rejected: { label: 'odrzucona', tone: 'crmx-chip--bad' },
  countered: { label: 'kontroferta', tone: 'crmx-chip--warn' },
  withdrawn: { label: 'wycofana', tone: '' },
};
const STEPS: Array<{ id: StepId; title: string; icon: typeof FileText; place?: string; amount?: string; done: string }> = [
  { id: 'preliminary', title: 'Umowa przedwstępna', icon: FileText, place: 'Kancelaria / miejsce', amount: 'Zadatek', done: 'Podpisana' },
  { id: 'deed', title: 'Akt notarialny', icon: Scale, place: 'Kancelaria notarialna', amount: 'Cena w akcie', done: 'Podpisany' },
  { id: 'handover', title: 'Przekazanie kluczy', icon: KeyRound, place: 'Stany liczników / uwagi', done: 'Przekazane' },
  { id: 'commission', title: 'Prowizja', icon: CircleDollarSign, amount: 'Kwota prowizji', done: 'Rozliczona' },
];

function amountOf(raw: string): number | null {
  const n = Number(raw.replace(/[^\d]/g, ''));
  return n > 0 ? n : null;
}
function dateLabel(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
function toInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
function hoursLeft(deadline: string): string {
  const h = Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000);
  return h > 0 ? `zostało ${h} h` : 'czas na odpowiedź minął';
}

/** Co się dzieje i co zrobić — nagłówek i krótka historia. */
function situation(deal: ProDeal): { headline: string; story: string } {
  const neg = deal.negotiation;
  const tx = deal.transaction || {};
  const turn = deal.turn;
  if (deal.status === 'WON' || deal.stage === 'closed') {
    return tx.commission?.done
      ? { headline: 'Transakcja zakończona', story: 'Akt podpisany, prowizja rozliczona. Wszystko zostaje w historii tej transakcji.' }
      : { headline: 'Zostało rozliczyć prowizję', story: 'Nieruchomość ma nowego właściciela. Zapisz kwotę prowizji i oznacz ją jako rozliczoną.' };
  }
  if (!neg?.agreedPrice) {
    if (!neg?.offers?.length) {
      return {
        headline: 'Zapisz pierwszą propozycję ceny',
        story: 'Negocjacje są otwarte. Wpisz, ile proponuje kupujący (albo ile chce sprzedający) — przekażesz to drugiej stronie, a ona ma 48 h na odpowiedź.',
      };
    }
    if (turn.side === 'agent') return { headline: 'Twój ruch w negocjacjach', story: turn.label };
    if (turn.side === 'buyer' || turn.side === 'seller') {
      return {
        headline: `Czekamy na ${turn.side === 'buyer' ? 'kupującego' : 'sprzedającego'}`,
        story: `${turn.label}${turn.deadline ? ` — ${hoursLeft(turn.deadline)}` : ''}. Jeśli odpowie telefonicznie, zapisz odpowiedź niżej.`,
      };
    }
    return { headline: 'Negocjacje ceny', story: turn.label || 'Zapisz kolejną propozycję albo odpowiedź drugiej strony.' };
  }
  if (!neg.reservation && !neg.reservationSkipped && !tx.preliminary?.done) {
    return {
      headline: `Cena uzgodniona: ${pln(neg.agreedPrice)}`,
      story: 'Zabezpiecz transakcję: zarezerwuj ofertę do konkretnej daty (inni kupujący zostaną wstrzymani albo rezerwowi) albo przejdź od razu do umowy. Potem ustal zadatek i terminy.',
    };
  }
  if (!tx.preliminary?.done) {
    return {
      headline: neg.reservation ? `Zarezerwowane do ${dateLabel(neg.reservation.until)}` : 'Przed umową przedwstępną',
      story: 'Ustal zadatek i termin umowy przedwstępnej, poproś obie strony o dokumenty, a po podpisaniu oznacz umowę jako podpisaną.',
    };
  }
  if (!tx.deed?.done) {
    return { headline: 'Przed aktem notarialnym', story: 'Umowa przedwstępna podpisana. Ustal kancelarię i termin aktu, dopilnuj dokumentów (np. decyzji kredytowej kupującego).' };
  }
  if (!tx.handover?.done) return { headline: 'Przekazanie kluczy', story: 'Akt podpisany. Umów przekazanie nieruchomości i zapisz stany liczników.' };
  return { headline: 'Zostało rozliczyć prowizję', story: 'Klucze przekazane. Zapisz kwotę prowizji i oznacz ją jako rozliczoną.' };
}

export default function CrmDealClosing({ deal, onOpenDocs }: { deal: ProDeal; onOpenDocs: (clientId: number, title: string) => void }) {
  const neg = deal.negotiation || { offers: [] };
  const tx = deal.transaction || {};
  const closed = deal.status === 'LOST';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [others, setOthers] = useState(0);

  const act: Act = async (body, ok) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/crm/offer-buyers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(String(json?.error || 'Nie udało się.'));
      setMsg({ ok: true, text: ok });
      const otherActive = Number(json?.otherActive) || 0;
      if (otherActive > 0) setOthers(otherActive);
      window.dispatchEvent(new Event('crm-deals-refresh'));
      return { ok: true, otherActive };
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Nie udało się.' });
      return { ok: false };
    } finally {
      setBusy(false);
    }
  };

  const s = situation(deal);
  const agreed = Boolean(neg.agreedPrice);
  const secured = Boolean(neg.reservation || neg.reservationSkipped || tx.preliminary?.done);

  return (
    <section className="crmx-card crmx-dealsheet__guide">
      <p className="crmx-eyebrow">Sytuacja</p>
      <h4 className="crmx-dealsheet__steptitle">{s.headline}</h4>
      <p className="crmx-dealsheet__hint">{s.story}</p>

      {others > 0 ? (
        <div className="crmx-close__others">
          <p className="text-[13px] font-semibold">
            Ta oferta ma jeszcze {others} {others === 1 ? 'innego kupującego' : 'innych kupujących'} w lejku.
          </p>
          <p className="crmx-dealsheet__hint">Wstrzymaj ich (znikną z aktywnych kolumn) albo zostaw jako rezerwowych na wypadek, gdyby ta transakcja upadła.</p>
          <div className="crmx-dealsheet__row">
            <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void act({ action: 'decide_others', decision: 'paused' }, 'Pozostali kupujący wstrzymani.').then(() => setOthers(0))}>
              Wstrzymaj pozostałych
            </button>
            <button type="button" className="crmx-btn" disabled={busy} onClick={() => void act({ action: 'decide_others', decision: 'backup' }, 'Pozostali kupujący są rezerwowi.').then(() => setOthers(0))}>
              Zostaw jako rezerwowych
            </button>
          </div>
        </div>
      ) : null}

      <ol className="crmx-dealsheet__steps">
        <Step n={1} title="Cena" done={agreed} summary={agreed ? `Uzgodniona: ${pln(neg.agreedPrice!)}` : null}>
          <Negotiation deal={deal} busy={busy} act={act} closed={closed} />
        </Step>
        <Step n={2} title="Rezerwacja, zadatek i terminy" done={secured && Boolean(neg.terms?.preliminaryAt)} locked={!agreed && !neg.reservation} lockedText="Otworzy się po uzgodnieniu ceny.">
          <Reservation deal={deal} busy={busy} act={act} closed={closed} />
        </Step>
        <Step n={3} title="Umowa, akt, klucze, prowizja" done={Boolean(tx.commission?.done)} locked={!agreed && !secured} lockedText="Otworzy się po uzgodnieniu ceny.">
          <div className="crmx-close__steps">
            {STEPS.map((step) => (
              <TxStep key={step.id} deal={deal} step={step} next={step.id === STEPS.find((x) => !tx[x.id]?.done)?.id} busy={busy} act={act} closed={closed} />
            ))}
          </div>
        </Step>
        <Step n={4} title="Dokumenty" done={false}>
          {deal.documentsVisible ? (
            <div className="crmx-dealsheet__form">
              <p className="crmx-dealsheet__hint">Wybierz, o jakie dokumenty prosisz każdą ze stron. Klient zobaczy listę w swoim panelu i doda skany — Ty je akceptujesz albo odrzucasz.</p>
              <div className="crmx-dealsheet__row">
                {deal.seller ? (
                  <button type="button" className="crmx-btn" onClick={() => onOpenDocs(deal.seller!.clientId, deal.seller!.name)}>
                    <FolderOpen size={15} /> Sprzedający
                  </button>
                ) : null}
                {deal.buyer.kind === 'client' ? (
                  <button type="button" className="crmx-btn" onClick={() => deal.buyer.kind === 'client' && onOpenDocs(deal.buyer.clientId, deal.buyer.name)}>
                    <FolderOpen size={15} /> Kupujący
                  </button>
                ) : null}
              </div>
              {deal.buyer.kind !== 'client' ? <p className="crmx-dealsheet__hint">Kupujący z innej agencji — jego dokumenty zbiera jego agent.</p> : null}
            </div>
          ) : (
            <div className="crmx-dealsheet__form">
              <p className="crmx-dealsheet__hint">Dokumenty otworzą się same po uzgodnieniu ceny. Możesz zacząć wcześniej, np. gdy kupujący czeka na decyzję kredytową.</p>
              {!closed ? (
                <button type="button" className="crmx-btn" disabled={busy} onClick={() => void act({ action: 'start_documents' }, 'Dokumenty otwarte — wybierz, o co prosisz.')}>
                  <FolderOpen size={15} /> Przygotuj dokumenty teraz
                </button>
              ) : null}
            </div>
          )}
        </Step>
      </ol>
      {msg ? <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
    </section>
  );
}

function Step({
  n,
  title,
  done,
  summary,
  locked,
  lockedText,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  summary?: string | null;
  locked?: boolean;
  lockedText?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!done);
  return (
    <li className="crmx-close__step" data-done={done || undefined} data-locked={locked || undefined}>
      <span className="crmx-dealsheet__num">{done ? <Check size={13} /> : n}</span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <button type="button" className="crmx-close__steptitle" onClick={() => setOpen((v) => !v)} disabled={locked}>
          <span className="text-[14px] font-semibold">{title}</span>
          {summary ? <span className="crmx-chip crmx-chip--good">{summary}</span> : null}
        </button>
        {locked ? <p className="crmx-dealsheet__hint">{lockedText}</p> : open ? children : null}
      </div>
    </li>
  );
}

/* ───────── 1 · Negocjacje ───────── */

function Negotiation({ deal, busy, act, closed }: { deal: ProDeal; busy: boolean; act: Act; closed: boolean }) {
  const neg = deal.negotiation || { offers: [] };
  const offers = neg.offers || [];
  const open = deal.turn?.offerId ? offers.find((o) => o.id === deal.turn.offerId) || null : null;
  const [by, setBy] = useState<'buyer' | 'seller'>(open?.by === 'buyer' ? 'seller' : 'buyer');
  const [amount, setAmount] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [counter, setCounter] = useState<string | null>(null);
  const fin = neg.financing || { kind: 'cash' as const, bank: null, decision: 'none' as const };

  useEffect(() => {
    setCounter(null);
    setRecommendation('');
  }, [deal.updatedAt]);

  const other = open ? (open.by === 'buyer' ? 'seller' : 'buyer') : null;
  const reachable = other === 'seller' ? Boolean(deal.seller) : deal.buyer.kind === 'client';
  const sentAt = open ? (open.by === 'buyer' ? open.sentToSellerAt : open.sentToBuyerAt) : null;

  const saveFin = (next: typeof fin) =>
    void act({ action: 'set_negotiation', financing: { kind: next.kind, bank: next.bank || undefined, decision: next.decision || 'none' } }, 'Finansowanie zapisane.');

  return (
    <div className="crmx-dealsheet__form">
      {deal.turn?.side && !neg.agreedPrice ? (
        <span className={`crmx-chip ${deal.turn.side === 'agent' ? 'crmx-chip--warn' : 'crmx-chip--info'}`} style={{ alignSelf: 'flex-start' }}>
          Ruch: {deal.turn.side === 'agent' ? 'Ty' : deal.turn.side === 'buyer' ? 'kupujący' : 'sprzedający'}
          {deal.turn.deadline ? ` · ${hoursLeft(deal.turn.deadline)}` : ''}
        </span>
      ) : null}

      {open && !closed && !neg.agreedPrice ? (
        <div className="crmx-close__offer">
          <div className="crmx-close__offerhead">
            <span className={open.by === 'buyer' ? 'crmx-close__buyer' : 'crmx-close__seller'}>{SIDE[open.by]}</span>
            <b className="crmx-num">{pln(open.amount)}</b>
          </div>
          {open.note ? <p className="crmx-dealsheet__hint">„{open.note}”</p> : null}

          {open.response ? (
            <>
              <p className="text-[13px]">
                {SIDE[other!]} {RESPONSE[open.response.kind]} {pln(open.response.kind === 'counter' && open.response.amount ? open.response.amount : open.amount)}
                {open.response.comment ? <span className="crmx-muted"> — „{open.response.comment}”</span> : null}
              </p>
              <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void act({ action: 'approve_response', offerId: open.id }, 'Zatwierdzone.')}>
                <Check size={15} />
                {open.response.kind === 'accept'
                  ? 'Potwierdź uzgodnienie ceny'
                  : open.response.kind === 'counter'
                    ? `Zatwierdź i wyślij do ${open.by === 'buyer' ? 'kupującego' : 'sprzedającego'}`
                    : 'Zatwierdź odmowę'}
              </button>
            </>
          ) : !sentAt ? (
            <>
              {reachable && open.by === 'buyer' ? (
                <label className="crmx-input">
                  <input value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Twoja rekomendacja dla sprzedającego (opcjonalnie)" />
                </label>
              ) : null}
              <button
                type="button"
                className="crmx-btn crmx-btn--gold"
                disabled={busy}
                onClick={() =>
                  void act(
                    { action: 'send_offer', offerId: open.id, recommendation: recommendation.trim() || undefined },
                    reachable ? 'Wysłane — druga strona ma 48 h na odpowiedź.' : 'Zapisane jako przekazane telefonicznie.',
                  )
                }
              >
                {reachable ? <Send size={15} /> : <Phone size={15} />}
                {reachable ? `Zatwierdź i wyślij do ${other === 'seller' ? 'sprzedającego' : 'kupującego'}` : 'Przekazane telefonicznie'}
              </button>
              {reachable ? (
                <p className="crmx-dealsheet__hint">
                  {other === 'seller' ? 'Sprzedający zobaczy ją jako „Kupujący N”, bez danych kupującego.' : 'Kupujący dostanie ją w panelu z przyciskami odpowiedzi.'} Czas na odpowiedź: 48 h.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="crmx-dealsheet__hint">Wysłano {dateLabel(sentAt)}. Odpowiedź przyszła telefonicznie? Zapisz ją:</p>
              <div className="crmx-dealsheet__row">
                <button type="button" className="crmx-btn crmx-btn--sm" disabled={busy} onClick={() => void act({ action: 'record_response', offerId: open.id, kind: 'accept' }, 'Zapisano: przyjmuje.')}>
                  Przyjmuje
                </button>
                <button type="button" className={`crmx-btn crmx-btn--sm ${counter !== null ? 'crmx-btn--primary' : ''}`} onClick={() => setCounter((v) => (v === null ? '' : null))}>
                  Kontroferta
                </button>
                <button type="button" className="crmx-btn crmx-btn--sm" disabled={busy} onClick={() => void act({ action: 'record_response', offerId: open.id, kind: 'reject' }, 'Zapisano: odrzuca.')}>
                  Odrzuca
                </button>
              </div>
              {counter !== null ? (
                <div className="crmx-dealsheet__row">
                  <label className="crmx-input" style={{ flex: 1 }}>
                    <input inputMode="numeric" value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Kwota kontroferty" />
                  </label>
                  <button
                    type="button"
                    className="crmx-btn crmx-btn--gold"
                    disabled={busy || !amountOf(counter)}
                    onClick={() => void act({ action: 'record_response', offerId: open.id, kind: 'counter', amount: amountOf(counter) }, 'Kontroferta zapisana.')}
                  >
                    Zapisz
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {!open && !closed && !neg.agreedPrice ? (
        <div className="crmx-close__new">
          <div className="crmx-seg">
            <button type="button" aria-pressed={by === 'buyer'} onClick={() => setBy('buyer')}>Kupujący proponuje</button>
            <button type="button" aria-pressed={by === 'seller'} onClick={() => setBy('seller')}>Sprzedający chce</button>
          </div>
          <div className="crmx-dealsheet__row">
            <label className="crmx-input" style={{ flex: 1 }}>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={deal.offer.price ? `Kwota, np. ${pln(deal.offer.price)}` : 'Kwota'} />
            </label>
            <button
              type="button"
              className="crmx-btn crmx-btn--gold"
              disabled={busy || !amountOf(amount)}
              onClick={() => void act({ action: 'add_offer', by, amount: amountOf(amount) }, 'Propozycja zapisana — teraz ją przekaż.').then((r) => r.ok && setAmount(''))}
            >
              Zapisz propozycję
            </button>
          </div>
        </div>
      ) : null}

      {offers.length ? (
        <div className="crmx-close__hist">
          <p className="crmx-eyebrow">Historia cen</p>
          {[...offers].reverse().map((o) => (
            <div key={o.id} className="crmx-close__histrow">
              <span className={o.by === 'buyer' ? 'crmx-close__buyer' : 'crmx-close__seller'}>{SIDE[o.by]}</span>
              <b className="crmx-num">{pln(o.amount)}</b>
              <span className="crmx-muted text-[11.5px]">{dateLabel(o.at)}</span>
              <span className={`crmx-chip ${OFFER_STATUS[o.status].tone}`}>{OFFER_STATUS[o.status].label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="crmx-eyebrow">Finansowanie kupującego</p>
      <div className="crmx-seg crmx-close__seg">
        {(
          [
            ['cash', 'Gotówka'],
            ['mortgage', 'Kredyt'],
            ['mixed', 'Gotówka + kredyt'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={fin.kind === k} disabled={busy || closed} onClick={() => saveFin({ ...fin, kind: k })}>
            {label}
          </button>
        ))}
      </div>
      {fin.kind !== 'cash' ? (
        <div className="crmx-seg crmx-close__seg">
          {(
            [
              ['pending', 'Decyzja w toku'],
              ['approved', 'Pozytywna'],
              ['rejected', 'Odmowa'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={fin.decision === k} disabled={busy || closed} onClick={() => saveFin({ ...fin, decision: k })}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ───────── 2 · Rezerwacja, zadatek, terminy ───────── */

function Reservation({ deal, busy, act, closed }: { deal: ProDeal; busy: boolean; act: Act; closed: boolean }) {
  const neg = deal.negotiation || { offers: [] };
  const [until, setUntil] = useState(toInput(neg.reservation?.until));
  const [deposit, setDeposit] = useState(neg.terms?.deposit ? String(neg.terms.deposit) : '');
  const [terms, setTerms] = useState({ preliminaryAt: toInput(neg.terms?.preliminaryAt), deedAt: toInput(neg.terms?.deedAt), handoverAt: toInput(neg.terms?.handoverAt) });
  useEffect(() => {
    setUntil(toInput(neg.reservation?.until));
    setDeposit(neg.terms?.deposit ? String(neg.terms.deposit) : '');
    setTerms({ preliminaryAt: toInput(neg.terms?.preliminaryAt), deedAt: toInput(neg.terms?.deedAt), handoverAt: toInput(neg.terms?.handoverAt) });
  }, [deal.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="crmx-dealsheet__form">
      {neg.reservation ? (
        <span className="crmx-chip crmx-chip--gold" style={{ alignSelf: 'flex-start' }}>
          <Lock size={12} /> Zarezerwowane do {dateLabel(neg.reservation.until)}
          {neg.othersDecision === 'paused' ? ' · pozostali wstrzymani' : neg.othersDecision === 'backup' ? ' · pozostali rezerwowi' : ''}
        </span>
      ) : neg.reservationSkipped ? (
        <p className="crmx-dealsheet__hint">Bez rezerwacji — od razu do umowy.</p>
      ) : (
        <p className="crmx-dealsheet__hint">Rezerwacja zdejmuje ofertę dla innych kupujących do wybranej daty.</p>
      )}
      {!closed ? (
        <div className="crmx-dealsheet__row">
          <label className="crmx-input" style={{ flex: 1, minWidth: 200 }}>
            <Lock />
            <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Rezerwacja do" />
          </label>
          <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy || !until} onClick={() => void act({ action: 'set_reservation', until: fromInput(until) }, 'Rezerwacja zapisana.')}>
            {neg.reservation ? 'Zmień datę' : 'Zarezerwuj'}
          </button>
          {!neg.reservation && !neg.reservationSkipped ? (
            <button type="button" className="crmx-btn" disabled={busy} onClick={() => void act({ action: 'skip_reservation' }, 'Bez rezerwacji — przechodzimy do umowy.')}>
              Bez rezerwacji
            </button>
          ) : null}
          {neg.reservation ? (
            <button type="button" className="crmx-btn crmx-btn--danger-soft" disabled={busy} onClick={() => void act({ action: 'set_reservation', until: null }, 'Rezerwacja zdjęta.')}>
              <X size={15} /> Zdejmij
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="crmx-eyebrow">Zadatek i terminy</p>
      <label className="crmx-input">
        <CircleDollarSign />
        <input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="Zadatek, np. 50 000" disabled={closed} />
      </label>
      <div className="crmx-close__dates">
        {(
          [
            ['preliminaryAt', 'Umowa przedwstępna'],
            ['deedAt', 'Akt notarialny'],
            ['handoverAt', 'Przekazanie kluczy'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="crmx-close__date">
            <span>{label}</span>
            <input type="datetime-local" value={terms[k]} disabled={closed} onChange={(e) => setTerms((t) => ({ ...t, [k]: e.target.value }))} />
          </label>
        ))}
      </div>
      {!closed ? (
        <button
          type="button"
          className="crmx-btn crmx-btn--gold"
          disabled={busy}
          onClick={() =>
            void act(
              {
                action: 'set_negotiation',
                terms: { deposit: amountOf(deposit), preliminaryAt: fromInput(terms.preliminaryAt), deedAt: fromInput(terms.deedAt), handoverAt: fromInput(terms.handoverAt) },
              },
              'Zadatek i terminy zapisane.',
            )
          }
        >
          Zapisz terminy
        </button>
      ) : null}
    </div>
  );
}

/* ───────── 3 · Umowa → akt → klucze → prowizja ───────── */

function TxStep({ deal, step, next, busy, act, closed }: { deal: ProDeal; step: (typeof STEPS)[number]; next: boolean; busy: boolean; act: Act; closed: boolean }) {
  const state = (deal.transaction || {})[step.id] || {};
  const terms = deal.negotiation?.terms || {};
  const planned = state.date || (step.id === 'preliminary' ? terms.preliminaryAt : step.id === 'deed' ? terms.deedAt : step.id === 'handover' ? terms.handoverAt : null);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(toInput(planned));
  const [place, setPlace] = useState(state.place || '');
  const [amount, setAmount] = useState(state.amount ? String(state.amount) : step.id === 'preliminary' && terms.deposit ? String(terms.deposit) : '');
  const Icon = step.icon;

  return (
    <div className="crmx-close__tx" data-done={state.done || undefined}>
      <div className="crmx-close__txhead">
        <span className="crmx-close__txicon">{state.done ? <Check size={15} /> : <Icon size={15} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">{step.title}</p>
          <p className="text-[11.5px] crmx-muted">
            {state.done ? `${step.done}${state.doneAt ? ` · ${dateLabel(state.doneAt)}` : ''}` : planned ? `Termin: ${dateLabel(planned)}` : step.id === 'commission' ? 'Do rozliczenia' : 'Bez terminu'}
          </p>
        </div>
        {!closed ? (
          <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Zwiń' : 'Edytuj'}
          </button>
        ) : null}
      </div>
      {state.place || state.amount ? (
        <p className="text-[12.5px]">{[state.place, state.amount ? `${step.amount}: ${pln(state.amount)}` : null].filter(Boolean).join(' · ')}</p>
      ) : null}
      {state.fileUrl ? (
        <a className="text-[12.5px] crmx-close__link" href={state.fileUrl} target="_blank" rel="noreferrer">
          {state.fileName || 'Plik'}
        </a>
      ) : null}
      {editing ? (
        <div className="crmx-dealsheet__form">
          {step.id !== 'commission' ? (
            <label className="crmx-close__date">
              <span>Termin</span>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          ) : null}
          {step.place ? (
            <label className="crmx-input">
              <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={step.place} />
            </label>
          ) : null}
          {step.amount ? (
            <label className="crmx-input">
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={step.amount} />
            </label>
          ) : null}
          <button
            type="button"
            className="crmx-btn crmx-btn--gold"
            disabled={busy}
            onClick={() =>
              void act(
                {
                  action: 'set_step',
                  step: step.id,
                  ...(step.id !== 'commission' ? { date: fromInput(date) } : {}),
                  ...(step.place ? { place } : {}),
                  ...(step.amount ? { amount: amountOf(amount) } : {}),
                },
                `${step.title}: zapisane.`,
              ).then((r) => r.ok && setEditing(false))
            }
          >
            Zapisz
          </button>
        </div>
      ) : null}
      {!closed ? (
        <button
          type="button"
          className={`crmx-btn crmx-btn--sm ${!state.done && next ? 'crmx-btn--gold' : ''}`}
          disabled={busy}
          onClick={() => void act({ action: 'set_step', step: step.id, done: !state.done }, state.done ? 'Cofnięto oznaczenie.' : `${step.title}: ${step.done.toLowerCase()}.`)}
        >
          {state.done ? <RotateCcw size={14} /> : <Check size={14} />}
          {state.done ? 'Cofnij oznaczenie' : `Oznacz: ${step.done.toLowerCase()}`}
        </button>
      ) : null}
    </div>
  );
}

/* ───────── Dokumenty jednej strony — osobny widok w oknie, z „Wstecz” ───────── */

type Doc = { key: string; label: string; hint?: string | null; required: boolean; status: 'missing' | 'uploaded' | 'accepted' | 'rejected' | 'na'; fileName: string | null; fileUrl: string | null };
type Suggestion = { key: string; label: string; hint: string | null; required: boolean };
const DOC_STATUS: Record<Doc['status'], { label: string; tone: string }> = {
  missing: { label: 'czeka na klienta', tone: '' },
  uploaded: { label: 'do sprawdzenia', tone: 'crmx-chip--warn' },
  accepted: { label: 'zaakceptowany', tone: 'crmx-chip--good' },
  rejected: { label: 'odrzucony', tone: 'crmx-chip--bad' },
  na: { label: 'nie dotyczy', tone: '' },
};

type DocsPayload = { documents?: Doc[]; documentSuggestions?: Suggestion[] };

export function DealDocumentsPanel({ clientId, name }: { clientId: number; name: string }) {
  const url = `/api/crm/clients/${clientId}/portal-tools`;
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = (json: DocsPayload & { tools?: DocsPayload }) => {
    const src = json.tools || json;
    if (Array.isArray(src.documents)) setDocs(src.documents);
    if (Array.isArray(src.documentSuggestions)) setSuggestions(src.documentSuggestions);
  };
  const load = () =>
    fetch(url, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then(apply)
      .catch(() => setDocs([]));
  useEffect(() => {
    void load();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(String(json?.error || 'Nie udało się.'));
      await load();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nie udało się.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="crmx-dealsheet">
      <div>
        <p className="crmx-eyebrow">Dokumenty</p>
        <h3 className="crmx-dealsheet__title">{name}</h3>
        <p className="crmx-dealsheet__hint">Zaznacz, o co prosisz. Klient widzi listę w swoim panelu i dodaje skany. Gdy coś przyjdzie, sprawdź i zaakceptuj albo odrzuć.</p>
      </div>
      <section className="crmx-card crmx-dealsheet__step">
        <p className="crmx-eyebrow">O co prosisz</p>
        {docs === null ? <p className="crmx-dealsheet__hint">Ładowanie…</p> : null}
        {docs && !docs.length ? <p className="crmx-dealsheet__hint">Nie prosisz jeszcze o żadne dokumenty — klient nic nie widzi.</p> : null}
        {docs?.map((d) => (
          <div key={d.key} className="crmx-close__doc">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{d.label}</p>
              <span className={`crmx-chip ${DOC_STATUS[d.status].tone}`}>{DOC_STATUS[d.status].label}</span>
              {d.fileUrl ? (
                <a className="crmx-close__link text-[12px]" href={d.fileUrl} target="_blank" rel="noreferrer">
                  {d.fileName || 'Podgląd'}
                </a>
              ) : null}
            </div>
            {d.status === 'uploaded' ? (
              <>
                <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--gold" disabled={busy} onClick={() => void post({ action: 'review_document', itemKey: d.key, status: 'accepted' })} title="Akceptuj">
                  <Check size={14} />
                </button>
                <button type="button" className="crmx-btn crmx-btn--sm" disabled={busy} onClick={() => void post({ action: 'review_document', itemKey: d.key, status: 'rejected' })} title="Odrzuć">
                  <X size={14} />
                </button>
              </>
            ) : null}
            <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--ghost" disabled={busy} onClick={() => void post({ action: 'remove_document', itemKey: d.key })} title="Usuń z listy">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
      {suggestions.length ? (
        <section className="crmx-card crmx-dealsheet__step">
          <p className="crmx-eyebrow">Typowe — zaznacz, o które prosisz</p>
          <div className="crmx-dealsheet__row">
            {suggestions.map((sug) => (
              <button
                key={sug.key}
                type="button"
                className={`crmx-chip crmx-close__pick ${picked.includes(sug.key) ? 'crmx-chip--gold' : ''}`}
                title={sug.hint || undefined}
                onClick={() => setPicked((cur) => (cur.includes(sug.key) ? cur.filter((k) => k !== sug.key) : [...cur, sug.key]))}
              >
                {picked.includes(sug.key) ? <Check size={12} /> : null}
                {sug.label}
              </button>
            ))}
          </div>
          {picked.length ? (
            <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void post({ action: 'add_suggested_documents', keys: picked }).then((ok) => ok && setPicked([]))}>
              Poproś o zaznaczone · {picked.length}
            </button>
          ) : null}
        </section>
      ) : null}
      <section className="crmx-card crmx-dealsheet__step">
        <p className="crmx-eyebrow">Inny dokument</p>
        <div className="crmx-dealsheet__row">
          <label className="crmx-input" style={{ flex: 1 }}>
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="np. Zaświadczenie o braku zaległości w czynszu" />
          </label>
          <button type="button" className="crmx-btn" disabled={busy || !custom.trim()} onClick={() => void post({ action: 'add_document', label: custom.trim() }).then((ok) => ok && setCustom(''))}>
            Poproś
          </button>
        </div>
      </section>
      {err ? <p className="crmx-dealsheet__msg is-bad">{err}</p> : null}
    </div>
  );
}
