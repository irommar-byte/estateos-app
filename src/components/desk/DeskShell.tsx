'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DeskCaseInspector } from '@/components/desk/DeskCaseInspector';
import { DeskOfferInspector } from '@/components/desk/DeskOfferInspector';
import { DeskRailNav } from '@/components/desk/DeskRailNav';
import { DESK_NAV, DESK_UI } from '@/lib/desk/labels';

type DeskInspectorState = {
  caseId: number | null;
  setCaseId: (id: number | null) => void;
  refreshKey: number;
  bumpRefresh: () => void;
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
};

const DeskInspectorContext = createContext<DeskInspectorState | null>(null);

export function useDeskInspector() {
  const ctx = useContext(DeskInspectorContext);
  if (!ctx) throw new Error('useDeskInspector outside provider');
  return ctx;
}

type SearchResult = {
  people: Array<{
    id: number;
    firstName: string;
    lastName: string;
    phone: string | null;
    deskCases: Array<{ id: number; kind: string }>;
  }>;
  cases: Array<{
    id: number;
    title: string | null;
    kind: string;
    pipelineStage: string;
    client: { firstName: string; lastName: string };
  }>;
  offers: Array<{ id: number; title: string | null; city: string | null; pricePln: number | null }>;
  tasks: Array<{ id: number; title: string; caseId: number | null }>;
  deals?: Array<{ id: number; status: string; offer: { id: number; title: string | null } | null }>;
  presentations?: Array<{ id: number; title: string | null; clientId: number; at: string }>;
};

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/crm';
  const router = useRouter();
  const [caseId, setCaseIdState] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [offerInspectorId, setOfferInspectorId] = useState<number | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'case' | 'offer'>('case');
  const [searching, setSearching] = useState(false);

  const bumpRefresh = useCallback(() => setRefreshKey((n) => n + 1), []);

  const setCaseId = useCallback((id: number | null) => {
    setCaseIdState(id);
    if (id) {
      setInspectorOpen(true);
      setInspectorMode('case');
      setOfferInspectorId(null);
    }
  }, []);

  useEffect(() => {
    const onOffer = (e: Event) => {
      const detail = (e as CustomEvent).detail as { offerId?: number };
      if (detail?.offerId) {
        setOfferInspectorId(detail.offerId);
        setInspectorMode('offer');
        setInspectorOpen(true);
      }
    };
    window.addEventListener('desk-offer-inspector', onOffer);
    return () => window.removeEventListener('desk-offer-inspector', onOffer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!cmdOpen || query.trim().length < 2) {
      setSearch(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/desk/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (!cancelled && res.ok) setSearch(json);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [cmdOpen, query]);

  const value = useMemo(
    () => ({
      caseId,
      setCaseId,
      refreshKey,
      bumpRefresh,
      inspectorOpen,
      setInspectorOpen,
    }),
    [bumpRefresh, caseId, inspectorOpen, refreshKey, setCaseId],
  );

  return (
    <DeskInspectorContext.Provider value={value}>
      <div className="eos-desk-root">
        <div className="eos-desk-shell">
          <header className="eos-desk-topbar">
            <div className="eos-desk-brand">
              EstateOS<span>™</span> Desk
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button type="button" className="eos-desk-btn" onClick={() => setCmdOpen(true)}>
                {DESK_UI.searchCmdK}
              </button>
              <Link href="/moje-konto/ogloszenia" className="eos-desk-btn">
                {DESK_UI.myOffers}
              </Link>
            </div>
          </header>

          <DeskRailNav pathname={pathname} variant="rail" />

          <main className="eos-desk-workspace">{children}</main>

          <aside className="eos-desk-inspector" data-open={inspectorOpen}>
            <button
              type="button"
              className="eos-desk-btn eos-desk-inspector-close"
              onClick={() => setInspectorOpen(false)}
            >
              Zamknij inspektor
            </button>
            {inspectorMode === 'offer' ? (
              <>
                <button
                  type="button"
                  className="eos-desk-btn"
                  style={{ marginBottom: '0.65rem' }}
                  onClick={() => {
                    setInspectorMode('case');
                    setOfferInspectorId(null);
                  }}
                >
                  {DESK_UI.backToCase}
                </button>
                <DeskOfferInspector
                  offerId={offerInspectorId}
                  onOpenCase={(id) => {
                    setCaseId(id);
                    setInspectorMode('case');
                  }}
                  onOpenMap={(lat, lng) => {
                    window.dispatchEvent(
                      new CustomEvent('desk-map-focus', { detail: { lat, lng } }),
                    );
                    router.push(`/crm/map${caseId ? `?caseId=${caseId}` : ''}`);
                  }}
                />
              </>
            ) : (
              <DeskCaseInspector caseId={caseId} onRefresh={bumpRefresh} />
            )}
          </aside>

          <DeskRailNav pathname={pathname} variant="dock" />
        </div>

        {cmdOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            className="eos-desk-cmd-overlay"
            onClick={() => setCmdOpen(false)}
          >
            <div className="eos-desk-card eos-desk-cmd-panel" onClick={(e) => e.stopPropagation()}>
              <p className="eos-desk-kicker">{DESK_UI.searchDialogTitle}</p>
              <input
                className="eos-desk-input"
                autoFocus
                placeholder="Szukaj klienta, sprawy, adresu, telefonu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="eos-desk-btn"
                  onClick={() => {
                    setCmdOpen(false);
                    router.push('/crm/prospecting');
                  }}
                >
                  + {DESK_UI.newProspect}
                </button>
                <button
                  type="button"
                  className="eos-desk-btn"
                  onClick={() => {
                    setCmdOpen(false);
                    router.push('/crm');
                  }}
                >
                  {DESK_UI.todayTitle}
                </button>
              </div>

              {searching ? <p className="eos-desk-muted">{DESK_UI.searching}</p> : null}

              {search ? (
                <div style={{ marginTop: '0.85rem', maxHeight: '50vh', overflow: 'auto' }}>
                  {search.cases.map((c) => (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      className="eos-desk-btn eos-desk-cmd-result"
                      onClick={() => {
                        setCaseId(c.id);
                        setCmdOpen(false);
                      }}
                    >
                      Sprawa · {c.client.firstName} {c.client.lastName} · {c.kind}/{c.pipelineStage}
                    </button>
                  ))}
                  {search.people.map((p) => (
                    <button
                      key={`p-${p.id}`}
                      type="button"
                      className="eos-desk-btn eos-desk-cmd-result"
                      onClick={() => {
                        const first = p.deskCases[0]?.id;
                        if (first) setCaseId(first);
                        setCmdOpen(false);
                      }}
                    >
                      Osoba · {p.firstName} {p.lastName} {p.phone || ''}
                    </button>
                  ))}
                  {search.offers.map((o) => (
                    <button
                      key={`o-${o.id}`}
                      type="button"
                      className="eos-desk-btn eos-desk-cmd-result"
                      onClick={() => {
                        setOfferInspectorId(o.id);
                        setInspectorMode('offer');
                        setInspectorOpen(true);
                        setCmdOpen(false);
                      }}
                    >
                      Oferta · {o.title} · {o.city}
                    </button>
                  ))}
                  {(search.deals || []).map((d) => (
                    <button
                      key={`d-${d.id}`}
                      type="button"
                      className="eos-desk-btn eos-desk-cmd-result"
                      onClick={() => {
                        setCmdOpen(false);
                        router.push('/crm/cases');
                      }}
                    >
                      Transakcja · {d.offer?.title || `#${d.id}`} · {d.status}
                    </button>
                  ))}
                  {(search.presentations || []).map((p) => (
                    <button
                      key={`pr-${p.id}`}
                      type="button"
                      className="eos-desk-btn eos-desk-cmd-result"
                      onClick={() => setCmdOpen(false)}
                    >
                      Prezentacja · {p.title || `#${p.id}`}
                    </button>
                  ))}
                  {search.tasks.map((t) => (
                    <button
                      key={`t-${t.id}`}
                      type="button"
                      className="eos-desk-btn eos-desk-cmd-result"
                      onClick={() => {
                        if (t.caseId) setCaseId(t.caseId);
                        setCmdOpen(false);
                      }}
                    >
                      Zadanie · {t.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </DeskInspectorContext.Provider>
  );
}

// exported for mobile dock slice count
export { DESK_NAV };
