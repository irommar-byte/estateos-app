'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BadgePercent,
  Building2,
  Calculator,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  Inbox,
  LayoutDashboard,
  LayoutList,
  Link2,
  Map,
  MessageCircle,
  Plus,
  Radar,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { VaultModal, VaultSection } from '@/components/wallet/Vault';

export type CrmProTab = 'pulpit' | 'klienci' | 'wiadomosci' | 'my_offers' | 'transakcje' | 'planowanie' | 'offers' | 'radar' | 'smart' | 'zespol';

type IconType = typeof Users;

const ITEMS: Array<{ id: CrmProTab; label: string; Icon: IconType }> = [
  { id: 'pulpit', label: 'Pulpit', Icon: LayoutDashboard },
  { id: 'radar', label: 'Radar', Icon: Radar },
  { id: 'klienci', label: 'Klienci', Icon: Users },
  { id: 'wiadomosci', label: 'Wiadomości', Icon: MessageCircle },
  { id: 'my_offers', label: 'Ogłoszenia', Icon: Building2 },
  { id: 'transakcje', label: 'Transakcje', Icon: ArrowLeftRight },
  { id: 'smart', label: 'Smart Agent OS™', Icon: Sparkles },
  { id: 'planowanie', label: 'Planowanie', Icon: CalendarDays },
  { id: 'offers', label: 'Ulubione', Icon: Heart },
  { id: 'zespol', label: 'Dziennik zespołu', Icon: ScrollText },
];

/** Gotowe skróty do wyboru; można też dodać własny adres. */
const SHORTCUT_CATALOG: Array<{ id: string; label: string; href: string; Icon: IconType }> = [
  { id: 'sesje', label: 'Sesje zdjęciowe', href: '/moje-konto/sesje-zdjeciowe', Icon: Camera },
  { id: 'firma', label: 'Moje biuro', href: '/moje-konto/firma', Icon: Building2 },
  { id: 'dodaj', label: 'Dodaj ogłoszenie', href: '/dodaj-oferte', Icon: Plus },
  { id: 'ogloszenia', label: 'Moje ogłoszenia', href: '/moje-konto/ogloszenia', Icon: LayoutList },
  { id: 'skrzynka', label: 'Skrzynka', href: '/moje-konto/wiadomosci', Icon: Inbox },
  { id: 'wycena', label: 'Wycena', href: '/wycena', Icon: Calculator },
  { id: 'szukam', label: 'Wyszukiwarka kupującego', href: '/szukam', Icon: Search },
  { id: 'mapa', label: 'Mapa ofert', href: '/odkryj-mape', Icon: Map },
  { id: 'cennik', label: 'Pakiety i cennik', href: '/cennik', Icon: BadgePercent },
  { id: 'weryfikacja', label: 'Weryfikacja konta', href: '/moje-konto/weryfikacja', Icon: ShieldCheck },
];

type Shortcut = { id: string; label: string; href: string };
type RailPrefs = { order: CrmProTab[]; hidden: CrmProTab[]; shortcuts: Shortcut[] };

const DEFAULT_PREFS: RailPrefs = {
  order: ITEMS.map((i) => i.id),
  hidden: [],
  shortcuts: SHORTCUT_CATALOG.filter((s) => s.id === 'sesje' || s.id === 'firma').map(({ id, label, href }) => ({ id, label, href })),
};
const MAX_SHORTCUTS = 8;

function iconFor(shortcut: Shortcut): IconType {
  return SHORTCUT_CATALOG.find((s) => s.id === shortcut.id)?.Icon ?? Link2;
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

/** Adres skrótu: ścieżka w serwisie albo pełny adres https. */
function normalizeHref(raw: string): string | null {
  const v = raw.trim();
  if (/^\/[^\s]*$/.test(v) && !v.startsWith('//')) return v;
  if (/^https:\/\/[^\s]+$/i.test(v)) return v;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v)) return `https://${v}`;
  return null;
}

function sanitizePrefs(raw: unknown): RailPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const r = raw as Partial<RailPrefs>;
  const known = new Set(ITEMS.map((i) => i.id));
  const order = (Array.isArray(r.order) ? r.order : []).filter((id): id is CrmProTab => known.has(id as CrmProTab));
  for (const id of DEFAULT_PREFS.order) if (!order.includes(id)) order.push(id);
  const hidden = (Array.isArray(r.hidden) ? r.hidden : []).filter((id): id is CrmProTab => known.has(id as CrmProTab) && id !== 'pulpit');
  const shortcuts = (Array.isArray(r.shortcuts) ? r.shortcuts : [])
    .map((s) => {
      const href = normalizeHref(String(s?.href || ''));
      const label = String(s?.label || '').trim().slice(0, 40);
      return href && label ? { id: String(s?.id || href).slice(0, 60), label, href } : null;
    })
    .filter((s): s is Shortcut => s != null)
    .slice(0, MAX_SHORTCUTS);
  return { order, hidden, shortcuts: Array.isArray(r.shortcuts) ? shortcuts : DEFAULT_PREFS.shortcuts };
}

function useRailPrefs() {
  const [prefs, setPrefs] = useState<RailPrefs>(DEFAULT_PREFS);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/user/ui-preferences?key=crm_rail', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.success && j.value) setPrefs(sanitizePrefs(j.value));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((next: RailPrefs) => {
    setPrefs(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void fetch('/api/user/ui-preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'crm_rail', value: next }),
      }).catch(() => undefined);
    }, 350);
  }, []);

  return { prefs, update };
}

/** Pasek strzałek przy przewijanym poziomym pasku (gdy sekcje się nie mieszczą). */
function useOverflowArrows() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure]);
  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  return { ref, edges, scrollBy, measure };
}

/** Nawigacja CRM: sekcje do przełączania i własne skróty; na szerokim ekranie z boku, na węższym jako pasek u góry. */
export default function CrmProRail({
  active,
  tabs,
  counts,
  hot,
  onChange,
}: {
  active: CrmProTab;
  tabs: CrmProTab[];
  counts: Partial<Record<CrmProTab, number | null>>;
  hot?: Partial<Record<CrmProTab, boolean>>;
  onChange: (tab: CrmProTab) => void;
}) {
  const { prefs, update } = useRailPrefs();
  const [customizing, setCustomizing] = useState(false);
  const { ref, edges, scrollBy, measure } = useOverflowArrows();

  const items = useMemo(
    () =>
      prefs.order
        .map((id) => ITEMS.find((i) => i.id === id)!)
        .filter((item) => item && tabs.includes(item.id) && (!prefs.hidden.includes(item.id) || item.id === active)),
    [prefs, tabs, active],
  );

  useEffect(() => {
    measure();
    // Aktywna sekcja zawsze widoczna w poziomym pasku.
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, items.length, prefs.shortcuts.length, measure, ref]);

  return (
    <nav className="crmx-rail" aria-label="Sekcje CRM">
      <div className="crmx-rail__panel">
        {edges.left ? (
          <button type="button" className="crmx-rail__arrow crmx-rail__arrow--left" aria-label="Przewiń w lewo" onClick={() => scrollBy(-1)}>
            <ChevronLeft size={16} />
          </button>
        ) : null}
        <div ref={ref} className={`crmx-rail__scroll ${edges.left ? 'has-left' : ''} ${edges.right ? 'has-right' : ''}`}>
          <p className="crmx-rail__label">Sekcje</p>
          <div className="crmx-rail__group" role="list">
            {items.map(({ id, label, Icon }) => {
              const count = counts[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="listitem"
                  aria-current={active === id ? 'page' : undefined}
                  onClick={() => onChange(id)}
                  className="crmx-rail__item"
                >
                  <span className="crmx-rail__icon">
                    <Icon strokeWidth={1.8} />
                  </span>
                  <span className="crmx-rail__text">{label}</span>
                  {count != null && count > 0 ? (
                    <span className={`crmx-rail__count ${hot?.[id] ? 'crmx-rail__count--hot' : ''}`}>{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {prefs.shortcuts.length ? (
            <>
              <span className="crmx-rail__sep" aria-hidden />
              <p className="crmx-rail__label">Skróty</p>
              <div className="crmx-rail__group crmx-rail__group--shortcuts" role="list">
                {prefs.shortcuts.map((s) => {
                  const Icon = iconFor(s);
                  const external = isExternal(s.href);
                  return (
                    <Link
                      key={s.id}
                      role="listitem"
                      href={s.href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                      className="crmx-rail__item crmx-rail__item--shortcut"
                    >
                      <span className="crmx-rail__icon">
                        <Icon strokeWidth={1.8} />
                      </span>
                      <span className="crmx-rail__text">{s.label}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
        {edges.right ? (
          <button type="button" className="crmx-rail__arrow crmx-rail__arrow--right" aria-label="Przewiń w prawo" onClick={() => scrollBy(1)}>
            <ChevronRight size={16} />
          </button>
        ) : null}
        <button type="button" className="crmx-rail__customize" onClick={() => setCustomizing(true)} aria-label="Dostosuj pasek" title="Dostosuj pasek">
          <SlidersHorizontal size={16} />
          <span className="crmx-rail__text">Dostosuj pasek</span>
        </button>
      </div>

      <RailCustomize open={customizing} onClose={() => setCustomizing(false)} prefs={prefs} tabs={tabs} onChange={update} />
    </nav>
  );
}

function RailCustomize({
  open,
  onClose,
  prefs,
  tabs,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  prefs: RailPrefs;
  tabs: CrmProTab[];
  onChange: (next: RailPrefs) => void;
}) {
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [error, setError] = useState('');
  const order = prefs.order.filter((id) => tabs.includes(id));
  const full = prefs.shortcuts.length >= MAX_SHORTCUTS;

  const move = <T,>(list: T[], index: number, dir: -1 | 1): T[] => {
    const next = [...list];
    const target = index + dir;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const moveTab = (id: CrmProTab, dir: -1 | 1) => {
    const visibleOrder = move(order, order.indexOf(id), dir);
    const rest = prefs.order.filter((t) => !tabs.includes(t));
    onChange({ ...prefs, order: [...visibleOrder, ...rest] });
  };

  const toggleTab = (id: CrmProTab, visible: boolean) =>
    onChange({ ...prefs, hidden: visible ? prefs.hidden.filter((h) => h !== id) : [...prefs.hidden, id] });

  const addShortcut = (s: Shortcut) => {
    if (full || prefs.shortcuts.some((x) => x.href === s.href)) return;
    onChange({ ...prefs, shortcuts: [...prefs.shortcuts, s] });
  };

  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    const name = label.trim().slice(0, 40);
    const url = normalizeHref(href);
    if (!name) return setError('Podaj nazwę skrótu.');
    if (!url) return setError('Podaj adres w serwisie (np. /cennik) albo pełny adres https://…');
    if (prefs.shortcuts.some((x) => x.href === url)) return setError('Taki skrót już jest na pasku.');
    setError('');
    addShortcut({ id: `own:${Date.now()}`, label: name, href: url });
    setLabel('');
    setHref('');
  };

  const available = SHORTCUT_CATALOG.filter((c) => !prefs.shortcuts.some((s) => s.href === c.href));

  return (
    <VaultModal open={open} onClose={onClose} variant="gold" label="Dostosuj pasek CRM">
      <header className="vault-plain-head">
        <div>
          <p className="vault-section__title !mb-1">Pasek CRM</p>
          <h2 className="vault-plain-head__title">Dostosuj sekcje i skróty</h2>
          <p className="vault-note">Zmiany zapisują się od razu i działają na każdym Twoim urządzeniu.</p>
        </div>
        <button type="button" className="vault-plain-head__close" onClick={onClose} aria-label="Zamknij">
          <X size={16} />
        </button>
      </header>

      <div className="vault-body">
        <VaultSection title="Sekcje">
          <div className="vault-list">
            {order.map((id, index) => {
              const item = ITEMS.find((i) => i.id === id)!;
              const visible = !prefs.hidden.includes(id);
              return (
                <div key={id} className={`vault-row ${visible ? '' : 'opacity-60'}`}>
                  <span className="vault-row__icon vault-row__icon--accent">
                    <item.Icon size={15} />
                  </span>
                  <span className="vault-row__text">
                    <span className="vault-row__title">{item.label}</span>
                  </span>
                  <span className="vault-order">
                    <button type="button" className="vault-step vault-step--sm" aria-label={`Przesuń wyżej: ${item.label}`} disabled={index === 0} onClick={() => moveTab(id, -1)}>
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" className="vault-step vault-step--sm" aria-label={`Przesuń niżej: ${item.label}`} disabled={index === order.length - 1} onClick={() => moveTab(id, 1)}>
                      <ArrowDown size={13} />
                    </button>
                  </span>
                  {id === 'pulpit' ? (
                    <span className="vault-row__pill">Zawsze</span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={visible}
                      aria-label={`Pokaż: ${item.label}`}
                      className="vault-switch"
                      onClick={() => toggleTab(id, !visible)}
                    >
                      <span className="vault-switch__knob" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </VaultSection>

        <VaultSection title={`Twoje skróty · ${prefs.shortcuts.length}/${MAX_SHORTCUTS}`}>
          {prefs.shortcuts.length ? (
            <div className="vault-list">
              {prefs.shortcuts.map((s, index) => {
                const Icon = iconFor(s);
                return (
                  <div key={s.id} className="vault-row">
                    <span className="vault-row__icon vault-row__icon--accent">
                      <Icon size={15} />
                    </span>
                    <span className="vault-row__text">
                      <span className="vault-row__title">{s.label}</span>
                      <span className="vault-row__meta">{s.href}</span>
                    </span>
                    <span className="vault-order">
                      <button type="button" className="vault-step vault-step--sm" aria-label={`Przesuń wyżej: ${s.label}`} disabled={index === 0} onClick={() => onChange({ ...prefs, shortcuts: move(prefs.shortcuts, index, -1) })}>
                        <ArrowUp size={13} />
                      </button>
                      <button type="button" className="vault-step vault-step--sm" aria-label={`Przesuń niżej: ${s.label}`} disabled={index === prefs.shortcuts.length - 1} onClick={() => onChange({ ...prefs, shortcuts: move(prefs.shortcuts, index, 1) })}>
                        <ArrowDown size={13} />
                      </button>
                      <button type="button" className="vault-step vault-step--sm" aria-label={`Usuń skrót: ${s.label}`} onClick={() => onChange({ ...prefs, shortcuts: prefs.shortcuts.filter((x) => x.id !== s.id) })}>
                        <X size={13} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="vault-empty">Nie masz jeszcze skrótów — dodaj je poniżej.</p>
          )}
        </VaultSection>

        {available.length ? (
          <VaultSection title="Dodaj skrót">
            <div className="vault-chips">
              {available.map((c) => (
                <button key={c.id} type="button" className="vault-chip" disabled={full} onClick={() => addShortcut({ id: c.id, label: c.label, href: c.href })}>
                  <c.Icon size={14} />
                  {c.label}
                  <Plus size={13} className="vault-chip__plus" />
                </button>
              ))}
            </div>
          </VaultSection>
        ) : null}

        <VaultSection title="Własny skrót">
          <form className="vault-form" onSubmit={addCustom}>
            <input className="vault-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nazwa, np. Raport tygodnia" maxLength={40} />
            <input className="vault-input" value={href} onChange={(e) => setHref(e.target.value)} placeholder="Adres, np. /cennik albo https://…" />
            <button type="submit" className="vault-btn !min-h-[46px]" disabled={full}>
              <Plus size={15} /> Dodaj skrót
            </button>
          </form>
          {error ? <p className="mt-2 text-[12px] font-semibold text-red-600">{error}</p> : null}
          {full ? <p className="vault-note mt-2">Masz już {MAX_SHORTCUTS} skrótów — usuń któryś, żeby dodać nowy.</p> : null}
        </VaultSection>

        <button type="button" className="vault-ghost" onClick={() => onChange(DEFAULT_PREFS)}>
          Przywróć ustawienia domyślne
        </button>
      </div>
    </VaultModal>
  );
}
