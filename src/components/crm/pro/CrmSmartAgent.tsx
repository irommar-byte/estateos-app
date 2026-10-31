'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Lock, Mail, MessageCircle, QrCode, Search, Send, Smartphone, Sparkles, Zap } from 'lucide-react';
import { pln, stamp } from './format';

/* ───────── dane ───────── */

type Triggers = { like: boolean; maybe: boolean; favorite: boolean };
type Access = {
  active: boolean;
  mode: 'enterprise' | 'paid' | null;
  from: string | null;
  until: string | null;
  seat: { enterprise: boolean; holderUserId: number | null; holderName: string | null; isAdmin: boolean } | null;
  canBuy: { ok: boolean; from: 'pool' | 'personal' | null; reason: string | null; missing: number };
};
type Item = {
  matchId: number;
  clientId: number;
  clientName: string;
  offerId: number;
  offerTitle: string;
  offerPrice: number | null;
  score: number;
  stage: 'sent' | 'maybe' | 'favorite' | 'like' | 'dislike';
  sentAt: string | null;
  reactedAt: string | null;
  note: string | null;
  toFunnel: boolean;
};
export type SmartAgentData = {
  userId: number;
  access: Access;
  triggers: Triggers;
  board: { items: Item[]; stats: { sent: number; reactions: number; toFunnel: number; toFunnelValue: number; buyers: number } };
  candidates: Array<{ userId: number; name: string }>;
  search: { url: string; qrUrl: string; leads: number; lastLeadAt: string | null };
};

export function useSmartAgent() {
  const [data, setData] = useState<SmartAgentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch('/api/crm/smart-agent', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => (j?.success ? (setData(j), setError(null)) : setError(String(j?.error || 'Błąd'))))
      .catch(() => setError('Błąd sieci'));
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('smart-agent-refresh', load);
    return () => window.removeEventListener('smart-agent-refresh', load);
  }, [load]);
  return { data, error, reload: load };
}

async function post(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch('/api/crm/smart-agent', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(String(json?.error || 'Nie udało się.'));
  window.dispatchEvent(new Event('smart-agent-refresh'));
  window.dispatchEvent(new Event('crm-deals-refresh'));
}

/** Przycisk płatności za brakujące kredyty — po opłaceniu wraca do CRM z kredytami na koncie. */
function BuyMissingCredits({ missing, className, onError }: { missing: number; className: string; onError: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const n = Math.max(1, missing);
  const buy = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pakiet_plus',
          credits: n,
          returnUrl: `${window.location.origin}/moje-konto/crm`,
          cancelUrl: window.location.href,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) throw new Error(String(json?.error || 'Nie udało się rozpocząć płatności.'));
      window.location.href = json.url;
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Nie udało się rozpocząć płatności.');
      setBusy(false);
    }
  };
  return (
    <button type="button" className={className} disabled={busy} onClick={() => void buy()}>
      <Zap size={14} /> {busy ? 'Przechodzę do płatności…' : `Dokup ${n} ${n === 1 ? 'kredyt' : n < 5 ? 'kredyty' : 'kredytów'}`}
    </button>
  );
}

/* ───────── wyszukiwarka /szukam w imieniu agenta ───────── */

const SHARE_TEXT = 'Dzień dobry, opisz proszę w dwie minuty, czego szukasz — od razu zacznę dobierać dla Ciebie oferty:';

function SmartSearchCard({ search, active }: { search: SmartAgentData['search']; active: boolean }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const text = `${SHARE_TEXT} ${search.url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(search.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ ok: false, text: 'Nie udało się skopiować — zaznacz link i skopiuj ręcznie.' });
    }
  };
  const invite = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await post('send_search_invite', { email, name });
      setMsg({ ok: true, text: `Wysłano do ${email.trim()}. Gdy wypełni formularz, trafi do Twoich klientów.` });
      setEmail('');
      setName('');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Nie udało się wysłać.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`crmx-card crmx-smartsearch ${active ? '' : 'is-locked'}`}>
      <div className="crmx-smartsearch__head">
        <div className="min-w-0">
          <p className="crmx-eyebrow"><Search size={12} /> Wyszukiwarka w Twoim imieniu</p>
          <h3 className="crmx-smartsearch__title">Wyślij kupującemu swoją wyszukiwarkę</h3>
          <p className="crmx-smartsearch__sub">
            Kupujący opisuje, czego szuka — z Twoim zdjęciem i nazwiskiem. Trafia od razu do Twoich klientów, dostaje panel,
            a Smart Agent OS™ sam dopasowuje i wysyła mu oferty.
          </p>
        </div>
        <div className="crmx-smartsearch__stat">
          <b className="crmx-num">{search.leads}</b>
          <span>{search.lastLeadAt ? `kupujących z wyszukiwarki · ostatni ${stamp(search.lastLeadAt)}` : 'kupujących z wyszukiwarki'}</span>
        </div>
      </div>

      {active ? (
        <>
          <div className="crmx-smartsearch__link">
            <span className="crmx-smartsearch__url">{search.url}</span>
            <button type="button" className="crmx-btn crmx-btn--sm" onClick={() => void copy()}>
              {copied ? <><Check size={13} /> Skopiowano</> : <><Copy size={13} /> Kopiuj</>}
            </button>
          </div>
          <div className="crmx-smartsearch__share">
            <a className="crmx-btn crmx-btn--sm" href={`sms:?&body=${encodeURIComponent(text)}`}><Smartphone size={13} /> SMS</a>
            <a className="crmx-btn crmx-btn--sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a>
            <a className="crmx-btn crmx-btn--sm" href={`mailto:?subject=${encodeURIComponent('Znajdę dla Ciebie nieruchomość')}&body=${encodeURIComponent(text)}`}><Mail size={13} /> Z Twojej poczty</a>
            <button type="button" className="crmx-btn crmx-btn--sm" aria-pressed={qr} onClick={() => setQr((v) => !v)}><QrCode size={13} /> Kod QR</button>
          </div>
          {qr ? (
            <div className="crmx-smartsearch__qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={search.qrUrl} alt="Kod QR do Twojej wyszukiwarki" width={168} height={168} />
              <p>Pokaż kupującemu na telefonie albo wydrukuj na wizytówce czy ulotce.</p>
            </div>
          ) : null}
          <form
            className="crmx-smartsearch__invite"
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
          >
            <p className="crmx-smartsearch__label">Albo wyślę za Ciebie e-mail — w Twoim imieniu, z Twoim podpisem</p>
            <div className="crmx-smartsearch__row">
              <label className="crmx-input"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Imię (opcjonalnie)" /></label>
              <label className="crmx-input" style={{ flex: '2 1 220px' }}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail kupującego" required /></label>
              <button type="submit" className="crmx-btn crmx-btn--gold" disabled={busy || !email.trim()}><Send size={14} /> {busy ? 'Wysyłam…' : 'Wyślij'}</button>
            </div>
          </form>
          {msg ? <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
        </>
      ) : (
        <p className="crmx-smartsearch__locked"><Lock size={13} /> Wyszukiwarka w Twoim imieniu działa przy aktywnym Smart Agent OS™ — włącz go powyżej.</p>
      )}
    </section>
  );
}

/* ───────── pasek życia: odliczanie + kolor gasnący z zielonego ───────── */

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function SmartLifeBar({ access, compact = false }: { access: Access; compact?: boolean }) {
  const now = useNow();
  if (!access.active || !access.until) return null;
  const until = new Date(access.until).getTime();
  const from = access.from ? new Date(access.from).getTime() : until - 30 * 86_400_000;
  const left = Math.max(0, until - now);
  const ratio = Math.max(0, Math.min(1, left / Math.max(1, until - from)));
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const mins = Math.floor((left % 3_600_000) / 60_000);
  const hue = Math.round(8 + 130 * ratio);
  const sat = Math.round(35 + 45 * ratio);
  return (
    <div className={`crmx-life ${compact ? 'crmx-life--compact' : ''}`} style={{ ['--life-h' as string]: hue, ['--life-s' as string]: `${sat}%` }}>
      <div className="crmx-life__row">
        <span className="crmx-life__count crmx-num">
          {days} dni {String(hours).padStart(2, '0')} h {String(mins).padStart(2, '0')} min
        </span>
        {!compact ? <span className="crmx-life__until">do {stamp(access.until)}</span> : null}
      </div>
      <div className="crmx-life__track">
        <div className="crmx-life__fill" style={{ width: `${(ratio * 100).toFixed(2)}%` }} />
      </div>
      {!compact ? (
        <p className="crmx-life__mode">{access.mode === 'enterprise' ? 'Stanowisko z pakietu Partner Enterprise' : 'Włączone za 5 kredytów'}</p>
      ) : null}
    </div>
  );
}

/* ───────── kolumna w lejku + połączenie (iskrzy, gdy odłączone) ───────── */

export function SmartAgentDock({ onOpen }: { onOpen: () => void }) {
  const { data } = useSmartAgent();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const access = data?.access;
  const active = Boolean(access?.active);
  const counts = useMemo(() => {
    const c = { sent: 0, maybe: 0, favorite: 0, like: 0 };
    for (const i of data?.board.items || []) if (i.stage in c) c[i.stage as keyof typeof c] += 1;
    return c;
  }, [data]);

  const buy = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await post('buy');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={`crmx-smartcol ${active ? 'is-on' : 'is-off'}`}>
        <header className="crmx-smartcol__head">
          <span className="crmx-smartcol__badge"><Sparkles size={12} /> Smart Agent OS™</span>
          {active ? <span className="crmx-smartcol__live">online</span> : <Lock size={13} />}
        </header>
        {!data ? (
          <p className="crmx-smartcol__text">Ładowanie…</p>
        ) : active ? (
          <>
            <div className="crmx-smartcol__stats">
              <div><b>{counts.sent}</b><span>Wysłane</span></div>
              <div><b>{counts.maybe + counts.favorite}</b><span>Rozważają</span></div>
              <div><b>{counts.like}</b><span>Chcą oglądać</span></div>
            </div>
            <SmartLifeBar access={access!} compact />
            <button type="button" className="crmx-smartcol__cta" onClick={onOpen}>
              Otwórz tablicę <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <p className="crmx-smartcol__text">
              Kolumna dla agentów z aktywnym <b>Smart Agent OS™</b> — inteligentny agent sam dopasowuje oferty, zbiera reakcje
              kupujących i przekazuje do lejka tylko tych, którzy chcą oglądać.
            </p>
            <p className="crmx-smartcol__fine">
              1 stanowisko w <b>Partner Enterprise</b>
              {access?.seat?.enterprise && access.seat.holderName ? ` (ma je: ${access.seat.holderName})` : ''} albo{' '}
              <b>5 kredytów / 30 dni</b>.
            </p>
            {access?.canBuy.ok ? (
              <button type="button" className="crmx-smartcol__cta" disabled={busy} onClick={() => void buy()}>
                <Zap size={14} /> Włącz za 5 kredytów
              </button>
            ) : access ? (
              <BuyMissingCredits missing={access.canBuy.missing} className="crmx-smartcol__cta" onError={setMsg} />
            ) : null}
            <button type="button" className="crmx-smartcol__link" onClick={onOpen}>Zobacz, jak działa</button>
            {msg ? <p className="crmx-smartcol__err">{msg}</p> : null}
          </>
        )}
      </section>
      <div className={`crmx-wire ${active ? 'is-on' : 'is-off'}`} aria-hidden="true">
        <span className="crmx-wire__a" />
        <span className="crmx-wire__b" />
        {!active ? (
          <span className="crmx-wire__sparks">
            <i /><i /><i /><i /><i />
          </span>
        ) : (
          <span className="crmx-wire__pulse" />
        )}
      </div>
    </>
  );
}

/* ───────── pełna tablica ───────── */

const STAGES: Array<{ id: Item['stage']; label: string; hint: string }> = [
  { id: 'sent', label: 'Wysłane', hint: 'Agent wysłał ofertę — bez reakcji kupującego' },
  { id: 'maybe', label: 'Do przemyślenia', hint: 'Kupujący odłożył na później' },
  { id: 'favorite', label: 'Ulubione', hint: 'Dodał do ulubionych w panelu' },
  { id: 'like', label: 'Chcę obejrzeć', hint: 'Kliknął „Chcę obejrzeć”' },
];

export default function CrmSmartAgentBoard({ onOpenClient }: { onOpenClient: (clientId: number) => void }) {
  const { data, error } = useSmartAgent();
  const [draft, setDraft] = useState<Triggers | null>(null);
  const [seatTo, setSeatTo] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const now = useNow(60_000);

  useEffect(() => {
    if (data) setDraft(data.triggers);
  }, [data?.triggers.like, data?.triggers.maybe, data?.triggers.favorite]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Nie udało się.' });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="crmx-card crmx-empty">{error}</div>;
  if (!data || !draft) return <div className="crmx-card crmx-empty">Ładowanie Smart Agent OS™…</div>;
  const { access, board } = data;
  const s = board.stats;
  const isHolder = access.seat?.holderUserId === data.userId;
  const elapsedDays = access.from ? Math.max(1, Math.ceil((now - new Date(access.from).getTime()) / 86_400_000)) : null;
  const dirty = draft.like !== data.triggers.like || draft.maybe !== data.triggers.maybe || draft.favorite !== data.triggers.favorite;

  return (
    <div className="space-y-4">
      <section className={`crmx-smarthero ${access.active ? 'is-on' : 'is-off'}`}>
        <div className="crmx-smarthero__main">
          <p className="crmx-smartcol__badge"><Sparkles size={12} /> Smart Agent OS™</p>
          <h3 className="crmx-smarthero__title">
            {access.active ? 'Pracuje dla Ciebie 24/7' : 'Twój inteligentny agent poszukiwań jest odłączony'}
          </h3>
          <p className="crmx-smarthero__sub">
            {access.active
              ? `Dopasowuje oferty z całego rynku do Twoich kupujących, wysyła je i zbiera reakcje. Do lejka przekazuje tylko tych, którzy reagują tak, jak ustawisz niżej.`
              : `Ta tablica i przekazywanie reakcji do lejka działają dla agentów z aktywnym stanowiskiem: 1 stanowisko w pakiecie Partner Enterprise (domyślnie kierownik biura, który może je przenieść) albo 5 kredytów na 30 dni.`}
          </p>
          {access.active ? (
            <SmartLifeBar access={access} />
          ) : (
            <div className="crmx-dealsheet__row">
              {access.canBuy.ok ? (
                <button type="button" className="crmx-btn crmx-btn--gold" disabled={busy} onClick={() => void run(() => post('buy'), 'Smart Agent OS™ włączony na 30 dni.')}>
                  <Zap size={15} /> Włącz za 5 kredytów ({access.canBuy.from === 'pool' ? 'z puli biura' : 'z Twoich kredytów'})
                </button>
              ) : (
                <BuyMissingCredits
                  missing={access.canBuy.missing}
                  className="crmx-btn crmx-btn--gold"
                  onError={(text) => setMsg({ ok: false, text })}
                />
              )}
              <Link href="/cennik?tab=partner" className="crmx-btn">Partner Enterprise <ArrowRight size={14} /></Link>
            </div>
          )}
        </div>
        <div className="crmx-smarthero__stats">
          <div><b className="crmx-num">{s.sent}</b><span>ofert wysłanych{elapsedDays ? ` w ${elapsedDays} dni` : ''}</span></div>
          <div><b className="crmx-num">{s.buyers}</b><span>kupujących obsłużonych</span></div>
          <div><b className="crmx-num">{s.reactions}</b><span>reakcji zebranych</span></div>
          <div><b className="crmx-num">{s.toFunnel}</b><span>przekazanych do lejka</span></div>
          <div className="is-money">
            <b className="crmx-num">{s.toFunnelValue > 0 ? pln(s.toFunnelValue * 0.02) : '0 zł'}</b>
            <span>
              {s.toFunnelValue > 0
                ? `potencjalnej prowizji (2% od ${pln(s.toFunnelValue)} wartości ofert przekazanych do lejka) — koszt: 5 kredytów`
                : 'potencjalnej prowizji — zacznie rosnąć, gdy kupujący przejdą do lejka'}
            </span>
          </div>
        </div>
      </section>

      <SmartSearchCard search={data.search} active={access.active} />

      <div className="crmx-smartgrid">
        <section className="crmx-card crmx-smartset">
          <p className="crmx-eyebrow">Kiedy kupujący trafia do lejka transakcji</p>
          {([
            ['like', 'Kliknie „Chcę obejrzeć”', 'Najpewniejszy sygnał — od razu do kolumny Zainteresowani.'],
            ['maybe', 'Odłoży na później („Do przemyślenia”)', 'Trafi do lejka z oznaczeniem „Do wyjaśnienia” — najpierw zadzwonisz do kupującego.'],
            ['favorite', 'Doda ofertę do ulubionych', 'Cichy sygnał zainteresowania — także „Do wyjaśnienia”.'],
          ] as Array<[keyof Triggers, string, string]>).map(([key, label, hint]) => (
            <label key={key} className="crmx-smartset__opt">
              <input type="checkbox" checked={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} />
              <span>
                <b>{label}</b>
                <small>{hint}</small>
              </span>
            </label>
          ))}
          <button
            type="button"
            className="crmx-btn crmx-btn--gold"
            disabled={busy || !dirty}
            onClick={() => void run(() => post('save_triggers', { triggers: draft }), 'Zapisano — lejek liczy się według nowych ustawień.')}
          >
            <Check size={15} /> Zapisz ustawienia
          </button>
          {!access.active ? <p className="crmx-dealsheet__hint">Ustawienia zaczną działać po włączeniu Smart Agent OS™.</p> : null}
        </section>

        {access.seat?.enterprise ? (
          <section className="crmx-card crmx-smartset">
            <p className="crmx-eyebrow">Stanowisko z pakietu Partner Enterprise</p>
            <p className="crmx-dealsheet__hint">
              Ma je teraz: <b>{access.seat.holderName || '—'}</b>
              {isHolder ? ' (Ty)' : ''}.
            </p>
            {access.seat.isAdmin && data.candidates.length > 1 ? (
              <>
                <label className="crmx-input">
                  <select value={seatTo} onChange={(e) => setSeatTo(e.target.value)}>
                    <option value="">Przekaż stanowisko agentowi…</option>
                    {data.candidates
                      .filter((c) => c.userId !== access.seat?.holderUserId)
                      .map((c) => (
                        <option key={c.userId} value={c.userId}>{c.name}</option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="crmx-btn"
                  disabled={busy || !seatTo}
                  onClick={() => void run(() => post('assign_seat', { toUserId: Number(seatTo) }), 'Stanowisko przekazane.')}
                >
                  Przekaż stanowisko
                </button>
              </>
            ) : null}
          </section>
        ) : null}
      </div>
      {msg ? <p className={`crmx-dealsheet__msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}

      <div className={`crmx-smartboard ${access.active ? '' : 'is-locked'}`}>
        {STAGES.map((st) => {
          const items = board.items.filter((i) => i.stage === st.id);
          return (
            <section key={st.id} className="crmx-col">
              <header className="crmx-col__head">
                <div className="min-w-0">
                  <span className="crmx-col__title">{st.label}</span>
                  <span className="crmx-col__meta">{st.hint}</span>
                </div>
                <span className="crmx-col__count">{items.length}</span>
              </header>
              <div className="crmx-col__body">
                {items.length === 0 ? <p className="crmx-col__empty">Brak</p> : null}
                {items.map((i) => (
                  <button key={i.matchId} type="button" className="crmx-deal" onClick={() => onOpenClient(i.clientId)}>
                    <p className="crmx-deal__name">{i.clientName}</p>
                    <p className="crmx-deal__offer">{i.offerTitle}</p>
                    {i.note ? <p className="crmx-deal__why">„{i.note}”</p> : null}
                    <div className="crmx-deal__foot">
                      <span className="crmx-num">{pln(i.offerPrice)}</span>
                      <span className="crmx-muted">dopasowanie {i.score}%</span>
                    </div>
                    <p className="crmx-smartcard__time">
                      {i.reactedAt ? `Reakcja: ${stamp(i.reactedAt)}` : i.sentAt ? `Wysłano: ${stamp(i.sentAt)}` : ''}
                    </p>
                    {i.toFunnel ? <span className="crmx-chip crmx-chip--gold">→ w lejku transakcji</span> : null}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {!access.active ? (
          <div className="crmx-smartboard__lock">
            <Lock size={22} />
            <p>Odłączone od lejka</p>
            <small>Reakcje kupujących nie trafiają do transakcji, dopóki nie włączysz Smart Agent OS™.</small>
          </div>
        ) : null}
      </div>
      <p className="crmx-funnel__legend">Nie pasuje: {board.items.filter((i) => i.stage === 'dislike').length} — te reakcje nigdy nie trafiają do lejka.</p>
    </div>
  );
}
