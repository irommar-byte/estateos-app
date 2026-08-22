'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DESK_TEMPLATES } from '@/lib/desk/templates';
import { labelDeskActivityKind, timelineKindLabel } from '@/lib/desk/timeline';
import { resolveDoItNowAction, type DoItNowAction } from '@/lib/desk/nextActionRouter';
import { DeskIframeDrawer } from '@/components/desk/DeskDrawer';
import SellerAcquisitionWorkspace from '@/components/crm/SellerAcquisitionWorkspace';
import OfferOwnerPublishPanel from '@/components/offer/OfferOwnerPublishPanel';
import MarketValuationPanel from '@/components/market/MarketValuationPanel';
import { DeskOfferComparison } from '@/components/desk/DeskOfferComparison';
import { DeskCaseCommandCenter } from '@/components/desk/DeskCaseCommandCenter';
import { BuyerQualifyForm } from '@/components/desk/BuyerQualifyForm';
import { DeskChecklistPanel } from '@/components/desk/DeskChecklistPanel';
import { DeskSellerReport } from '@/components/desk/DeskSellerReport';
import type { BuyerQualificationExtended } from '@/lib/desk/buyerQualification';
import {
  DESK_UI,
  labelDeskKind,
  labelDeskSection,
  labelDeskStage,
  labelHealth,
  labelTemperature,
} from '@/lib/desk/labels';

type InspectorCase = {
  id: number;
  title: string | null;
  kind: string;
  pipelineStage: string;
  health: string;
  temperature: string;
  nextAction: string | null;
  nextActionAt: string | null;
  lastContactedAt: string | null;
  contractEndsAt: string | null;
  source: string | null;
  sourceUrl: string | null;
  propertySnapshot: Record<string, unknown> | null;
  linkedOfferId: number | null;
  client: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    type: string;
    notes: string | null;
    portalToken: string | null;
    acquisition: {
      id: number;
      status: string;
      signedAt: string | null;
      formData: unknown;
      currentStep: number;
    } | null;
    buyerPreference: Record<string, unknown> | null;
    matches?: Array<{
      score: number;
      offer: {
        id: number;
        title: string | null;
        pricePln: number | null;
        city: string | null;
        district: string | null;
        area: number | null;
        rooms: number | null;
        status: string;
      };
    }>;
  };
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    dueAt: string | null;
    priority: string;
  }>;
};

type DetailPayload = {
  case: InspectorCase;
  linkedOffer: {
    id: number;
    title: string | null;
    status: string;
    pricePln: number | null;
    listPricePln: number | null;
    city: string | null;
    district: string | null;
    street: string | null;
    area: number | null;
    rooms: number | null;
    expiresAt: string | null;
  } | null;
  matchingBuyers: Array<{
    clientId: number;
    name: string;
    score: number;
    phone: string | null;
    email: string | null;
    temperature: string | null;
  }>;
  siblingCases: Array<{ id: number; kind: string; pipelineStage: string; title: string | null }>;
  timeline: Array<{
    id: string;
    at: string;
    kind: string;
    title: string;
    body?: string | null;
    source: string;
  }>;
  contract: {
    signedAt: string | null;
    status: string | null;
    agreementType: string | null;
    commissionType: string | null;
    commissionValue: string | null;
    durationMonths: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
    documentHash: string | null;
  };
  nextBestAction: { id: number | null; title: string; dueAt: string | null; priority: string } | null;
  checklist?: Array<{
    id: number;
    title: string;
    status: string;
    dueAt: string | null;
    priority: string;
    metadata?: unknown;
  }>;
  qualification?: BuyerQualificationExtended | null;
};

const SECTIONS = [
  'SUMMARY',
  'CHECKLIST',
  'CONTACT',
  'ACQUISITION',
  'CONTRACT',
  'LISTING',
  'MARKETING',
  'REPORT',
  'MATCHING',
  'GUESTS',
  'DEAL',
  'DEBRIEF',
  'TEMPLATES',
  'TIMELINE',
] as const;

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function DeskCaseInspector({
  caseId,
  onCaseMeta,
  onRefresh,
}: {
  caseId: number | null;
  onCaseMeta?: (meta: {
    case: InspectorCase;
    nextBestAction: DetailPayload['nextBestAction'];
  }) => void;
  onRefresh?: () => void;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('SUMMARY');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [debrief, setDebrief] = useState({
    result: 'interested',
    temperature: 'WARM',
    nextAction: '',
    nextActionAt: '',
  });
  const [selectedBuyers, setSelectedBuyers] = useState<number[]>([]);
  const [drawer, setDrawer] = useState<{ open: boolean; title: string; src: string | null }>({
    open: false,
    title: '',
    src: null,
  });
  const [acqClient, setAcqClient] = useState<any>(null);
  const [guests, setGuests] = useState<{
    guests: Array<{ user: { id: number; name: string | null; email: string | null; phone: string | null } }>;
    bidders: Array<{
      amount: number;
      user: { id: number; name: string | null; email: string | null; phone: string | null };
    }>;
  } | null>(null);

  const load = useCallback(async () => {
    if (!caseId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/desk/cases/${caseId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Błąd');
      setData(json);
      onCaseMeta?.({ case: json.case, nextBestAction: json.nextBestAction });

      // Shape minimal seller client for acquisition workspace
      const c = json.case.client;
      setAcqClient({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        sellerCity: json.case.propertySnapshot?.city || null,
        sellerDistrict: json.case.propertySnapshot?.district || null,
        sellerPrice: json.case.propertySnapshot?.price || null,
        sellerArea: json.case.propertySnapshot?.area || null,
        sellerRooms: json.case.propertySnapshot?.rooms || null,
        sellerDescription: json.case.propertySnapshot?.note || null,
        portalToken: c.portalToken,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [caseId, onCaseMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  const postOutcome = useCallback(
    async (outcome: string, payload: Record<string, unknown> = {}) => {
      if (!caseId) return;
      setBusy(outcome);
      try {
        const res = await fetch(`/api/desk/cases/${caseId}/outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome, payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Błąd');
        await load();
        onRefresh?.();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Błąd');
      } finally {
        setBusy(null);
      }
    },
    [caseId, load, onRefresh],
  );

  const visibleSections = useMemo((): Array<(typeof SECTIONS)[number]> => {
    if (!data) return [...SECTIONS];
    if (data.case.kind === 'BUY') {
      return ['SUMMARY', 'CHECKLIST', 'CONTACT', 'MATCHING', 'DEAL', 'DEBRIEF', 'TEMPLATES', 'TIMELINE'];
    }
    const sell = [...SECTIONS];
    if (!data.linkedOffer) return sell.filter((s) => s !== 'REPORT' && s !== 'MATCHING' && s !== 'GUESTS');
    return sell;
  }, [data]);

  const handleDoItNow = useCallback(
    async (action: DoItNowAction) => {
      if (!caseId || !data) return;
      switch (action.type) {
        case 'section':
          setSection(action.section as (typeof SECTIONS)[number]);
          break;
        case 'call':
          window.location.href = `tel:${action.phone}`;
          break;
        case 'sms':
          window.location.href = `sms:${action.phone}${action.body ? `?body=${encodeURIComponent(action.body)}` : ''}`;
          break;
        case 'email':
          window.location.href = `mailto:${action.email}?subject=${encodeURIComponent(action.subject || '')}&body=${encodeURIComponent(action.body || '')}`;
          break;
        case 'drawer':
          setDrawer({ open: true, title: action.title, src: action.src });
          break;
        case 'outcome':
          await postOutcome(action.outcome, action.payload || {});
          break;
        case 'task_complete':
          await fetch('/api/desk/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: action.taskId, status: 'DONE' }),
          });
          await load();
          onRefresh?.();
          break;
        case 'refresh_matches':
          await fetch(`/api/desk/cases/${caseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'refresh_matches' }),
          });
          await load();
          onRefresh?.();
          break;
        case 'map':
          if (action.lat != null && action.lng != null) {
            window.dispatchEvent(
              new CustomEvent('desk-map-focus', {
                detail: { lat: action.lat, lng: action.lng, label: action.query },
              }),
            );
          }
          window.location.href = `/crm/map?caseId=${caseId}`;
          break;
        case 'offer_inspector':
          window.dispatchEvent(new CustomEvent('desk-offer-inspector', { detail: { offerId: action.offerId } }));
          break;
        case 'radar_send':
          setSection('MATCHING');
          break;
        case 'url':
          if (action.external) window.open(action.href, '_blank');
          else window.location.href = action.href;
          break;
        default:
          break;
      }
    },
    [caseId, data, load, onRefresh, postOutcome],
  );

  useEffect(() => {
    if (!data?.linkedOffer?.id || data.case.kind !== 'SELL') {
      setGuests(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/desk/offer-guests?offerId=${data.linkedOffer!.id}`);
      const json = await res.json();
      if (!cancelled && res.ok) setGuests({ guests: json.guests || [], bidders: json.bidders || [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.linkedOffer?.id, data?.case.kind]);

  if (!caseId) {
    return (
      <div className="eos-desk-inspector-empty">
        <p className="eos-desk-kicker">{DESK_UI.inspectorPanel}</p>
        <h2 className="eos-desk-h1 eos-desk-inspector-title">{DESK_UI.inspectorPickCase}</h2>
        <p className="eos-desk-muted eos-desk-inspector-empty__hint">{DESK_UI.inspectorPickCaseHint}</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <div className="eos-desk-skeleton" style={{ height: '1.2rem', width: '40%' }} />
        <div className="eos-desk-skeleton" style={{ height: '2rem', width: '70%', marginTop: '0.65rem' }} />
        <div className="eos-desk-skeleton" style={{ height: '8rem', marginTop: '0.85rem' }} />
      </div>
    );
  }
  if (error && !data) {
    return <p style={{ color: 'var(--desk-danger)' }}>{error}</p>;
  }
  if (!data) return null;

  const deskCase = data.case;
  const snap = deskCase.propertySnapshot || {};
  const phone = deskCase.client.phone;
  const offer = data.linkedOffer;

  return (
    <div>
      <p className="eos-desk-kicker">
        {labelDeskKind(deskCase.kind)} · #{deskCase.id}
      </p>

      <DeskCaseCommandCenter
        clientName={`${deskCase.client.firstName} ${deskCase.client.lastName}`}
        kind={deskCase.kind}
        stage={deskCase.pipelineStage}
        temperature={deskCase.temperature}
        health={deskCase.health}
        lastContactedAt={deskCase.lastContactedAt}
        nextAction={deskCase.nextAction}
        nextActionAt={deskCase.nextActionAt}
        nextBestAction={data.nextBestAction}
        busy={busy !== null}
        resolveAction={() =>
          resolveDoItNowAction(data.nextBestAction || { id: null, title: deskCase.nextAction || '' }, {
            id: deskCase.id,
            kind: deskCase.kind,
            pipelineStage: deskCase.pipelineStage,
            linkedOfferId: offer?.id || deskCase.linkedOfferId,
            client: deskCase.client,
          })
        }
        onDoItNow={(a) => void handleDoItNow(a)}
      />

      <div className="eos-desk-section-tabs">
        {visibleSections.map((s) => (
          <button
            key={s}
            type="button"
            className="eos-desk-btn eos-desk-section-tab"
            data-active={section === s}
            onClick={() => setSection(s)}
          >
            {labelDeskSection(s)}
          </button>
        ))}
      </div>

      {section === 'SUMMARY' ? (
        <div style={{ marginTop: '0.9rem', fontSize: '0.88rem' }} className="eos-desk-muted">
          <div>
            <strong style={{ color: 'var(--desk-ink)' }}>Nieruchomość:</strong>{' '}
            {typeof snap.address === 'string'
              ? snap.address
              : [offer?.street, offer?.district, offer?.city].filter(Boolean).join(', ') || '—'}
          </div>
          <div>
            <strong style={{ color: 'var(--desk-ink)' }}>Cena:</strong>{' '}
            {typeof snap.price === 'number'
              ? `${Number(snap.price).toLocaleString('pl-PL')} zł`
              : offer?.pricePln
                ? `${offer.pricePln.toLocaleString('pl-PL')} zł`
                : '—'}
          </div>
          <div>
            <strong style={{ color: 'var(--desk-ink)' }}>Źródło:</strong> {deskCase.source || '—'}
          </div>
          <div>
            <strong style={{ color: 'var(--desk-ink)' }}>Ostatni kontakt:</strong>{' '}
            {fmtWhen(deskCase.lastContactedAt)}
          </div>
          {data.siblingCases.length ? (
            <div style={{ marginTop: '0.5rem' }}>
              Dual-role:{' '}
              {data.siblingCases.map((s) => (
                <span key={s.id} className="eos-desk-chip" style={{ marginRight: '0.25rem' }}>
                  {s.kind} #{s.id}
                </span>
              ))}
            </div>
          ) : null}
          {data.contract.daysRemaining != null ? (
            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--desk-ink)' }}>
                Umowa · {data.contract.daysRemaining} dni pozostało
              </div>
              <div
                style={{
                  marginTop: '0.35rem',
                  height: '0.35rem',
                  borderRadius: '999px',
                  background: 'var(--desk-line)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(4, Math.min(100, ((data.contract.daysRemaining || 0) / 180) * 100))}%`,
                    height: '100%',
                    background: 'var(--desk-brass)',
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'CHECKLIST' ? (
        <div style={{ marginTop: '0.9rem' }}>
          <DeskChecklistPanel
            caseId={caseId!}
            items={(data.checklist || []) as Array<{
              id: number;
              title: string;
              status: string;
              dueAt: string | null;
              priority: string;
              metadata?: { stageKey?: string; catalogId?: string } | null;
            }>}
            onUpdated={async () => {
              await load();
              onRefresh?.();
            }}
          />
        </div>
      ) : null}

      {section === 'CONTACT' ? (
        <div style={{ marginTop: '0.9rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {phone ? (
              <a className="eos-desk-btn eos-desk-btn-primary" href={`tel:${phone}`}>
                Call
              </a>
            ) : null}
            {phone ? (
              <a className="eos-desk-btn" href={`sms:${phone}`}>
                SMS
              </a>
            ) : null}
            {deskCase.client.email ? (
              <a className="eos-desk-btn" href={`mailto:${deskCase.client.email}`}>
                Email
              </a>
            ) : null}
            {typeof snap.address === 'string' && snap.address ? (
              <a
                className="eos-desk-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(snap.address))}`}
                target="_blank"
                rel="noreferrer"
              >
                Navigate
              </a>
            ) : null}
          </div>
          <p className="eos-desk-kicker" style={{ marginTop: '0.9rem' }}>
            Wynik rozmowy
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {(
              [
                ['NO_ANSWER', 'No answer'],
                ['CALLBACK', 'Callback'],
                ['NOT_INTERESTED', 'Not interested'],
                ['INTERESTED', 'Interested'],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                className="eos-desk-btn"
                disabled={busy !== null}
                onClick={() => postOutcome(code)}
              >
                {busy === code ? '…' : label}
              </button>
            ))}
          </div>
          <p className="eos-desk-kicker" style={{ marginTop: '0.9rem' }}>
            Schedule
          </p>
          <input
            className="eos-desk-input"
            type="datetime-local"
            value={meetingAt}
            onChange={(e) => setMeetingAt(e.target.value)}
          />
          <button
            type="button"
            className="eos-desk-btn eos-desk-btn-brass"
            style={{ marginTop: '0.45rem' }}
            disabled={!meetingAt || busy !== null}
            onClick={() =>
              postOutcome('MEETING_BOOKED', {
                startsAt: new Date(meetingAt).toISOString(),
                location: typeof snap.address === 'string' ? snap.address : null,
              })
            }
          >
            Meeting booked
          </button>
          <textarea
            className="eos-desk-textarea"
            style={{ marginTop: '0.75rem' }}
            placeholder="Notatka…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className="eos-desk-btn"
            style={{ marginTop: '0.45rem' }}
            disabled={!note.trim()}
            onClick={async () => {
              await fetch(`/api/desk/cases/${caseId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_note', note }),
              });
              setNote('');
              await load();
              onRefresh?.();
            }}
          >
            Zapisz notatkę
          </button>
          {deskCase.kind === 'BUY' ? (
            <div style={{ marginTop: '1rem' }}>
              <BuyerQualifyForm
                caseId={caseId!}
                clientId={deskCase.client.id}
                buyerPreference={deskCase.client.buyerPreference}
                qualification={data.qualification || null}
                onSaved={async () => {
                  await load();
                  onRefresh?.();
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'ACQUISITION' && deskCase.kind === 'SELL' && acqClient ? (
        <div style={{ marginTop: '0.75rem' }}>
          <SellerAcquisitionWorkspace
            client={acqClient}
            onUpdated={async () => {
              const res = await fetch(`/api/crm/clients/${deskCase.client.id}/acquisition`);
              const json = await res.json().catch(() => ({}));
              if (json?.acquisition?.signedAt) {
                await postOutcome('CONTRACT_SIGNED', {
                  durationMonths: (json.acquisition.formData as any)?.cooperation?.durationMonths,
                });
              } else if (json?.acquisition?.status === 'IN_MEETING') {
                await postOutcome('MEETING_COMPLETED');
              }
              await load();
              onRefresh?.();
            }}
          />
        </div>
      ) : null}

      {section === 'CONTRACT' ? (
        <div style={{ marginTop: '0.9rem', fontSize: '0.9rem' }}>
          <div>Status: {data.contract.status || '—'}</div>
          <div>Typ: {data.contract.agreementType || '—'}</div>
          <div>
            Prowizja: {data.contract.commissionValue || '—'} {data.contract.commissionType || ''}
          </div>
          <div>Podpis: {fmtWhen(data.contract.signedAt)}</div>
          <div>Koniec: {fmtWhen(data.contract.endsAt)}</div>
          <div style={{ fontWeight: 700, marginTop: '0.5rem' }}>
            {data.contract.daysRemaining != null
              ? `${data.contract.daysRemaining} DAYS REMAINING`
              : 'Brak aktywnej umowy w Desk'}
          </div>
          {deskCase.pipelineStage === 'CONTRACT' || data.contract.signedAt ? (
            <button
              type="button"
              className="eos-desk-btn eos-desk-btn-brass"
              style={{ marginTop: '0.75rem' }}
              onClick={() =>
                setDrawer({
                  open: true,
                  title: 'Przygotuj listing',
                  src: `/dodaj-oferte?agencyClientId=${deskCase.client.id}&embed=1`,
                })
              }
            >
              Listing preparation → ClientForm
            </button>
          ) : null}
        </div>
      ) : null}

      {section === 'LISTING' ? (
        <div style={{ marginTop: '0.9rem' }}>
          {offer ? (
            <>
              <div style={{ fontWeight: 700 }}>{offer.title}</div>
              <div className="eos-desk-muted" style={{ fontSize: '0.88rem' }}>
                {offer.pricePln?.toLocaleString('pl-PL')} zł · {offer.status}
                {offer.expiresAt ? ` · wygasa ${fmtWhen(offer.expiresAt)}` : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem' }}>
                <button
                  type="button"
                  className="eos-desk-btn"
                  onClick={() =>
                    setDrawer({
                      open: true,
                      title: `Edycja oferty #${offer.id}`,
                      src: `/edytuj-oferte/${offer.id}`,
                    })
                  }
                >
                  Edytuj w drawerze
                </button>
                <a className="eos-desk-btn" href={`/oferta/${offer.id}`} target="_blank" rel="noreferrer">
                  Open offer
                </a>
                <button
                  type="button"
                  className="eos-desk-btn eos-desk-btn-brass"
                  disabled={busy !== null}
                  onClick={() => postOutcome('LISTING_PUBLISHED', { offerId: offer.id })}
                >
                  Mark published → LIVE
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="eos-desk-btn eos-desk-btn-primary"
              onClick={() =>
                setDrawer({
                  open: true,
                  title: 'Nowa oferta',
                  src: `/dodaj-oferte?agencyClientId=${deskCase.client.id}`,
                })
              }
            >
              Utwórz ofertę (ClientForm)
            </button>
          )}
        </div>
      ) : null}

      {section === 'MARKETING' && offer ? (
        <div style={{ marginTop: '0.75rem' }}>
          <OfferOwnerPublishPanel offerId={offer.id} />
          <div style={{ marginTop: '0.75rem' }}>
            <a className="eos-desk-btn" href={`/kampania?offerId=${offer.id}`} target="_blank" rel="noreferrer">
              Campaign kit
            </a>
          </div>
          <MarketValuationPanel
            purpose="crm"
            city={offer.city || undefined}
            district={offer.district || undefined}
            listingPrice={offer.pricePln || undefined}
            area={offer.area || undefined}
            rooms={offer.rooms || undefined}
            clientId={deskCase.client.id}
            showReport
          />
        </div>
      ) : null}

      {section === 'REPORT' && offer && deskCase.kind === 'SELL' ? (
        <div style={{ marginTop: '0.75rem' }}>
          <DeskSellerReport offerId={offer.id} clientId={deskCase.client.id} />
        </div>
      ) : null}

      {section === 'MATCHING' ? (
        <div style={{ marginTop: '0.9rem' }}>
          {deskCase.kind === 'BUY' ? (
            <>
              <button
                type="button"
                className="eos-desk-btn eos-desk-btn-brass"
                onClick={async () => {
                  await fetch(`/api/desk/cases/${caseId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'refresh_matches' }),
                  });
                  await load();
                }}
              >
                Odśwież dopasowania
              </button>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
                {(deskCase.client.matches || []).map((m) => (
                  <li
                    key={m.offer.id}
                    style={{ borderTop: '1px solid var(--desk-line)', padding: '0.5rem 0' }}
                  >
                    <div style={{ fontWeight: 600 }}>{m.offer.title}</div>
                    <div className="eos-desk-muted" style={{ fontSize: '0.82rem' }}>
                      {m.score}% · {m.offer.pricePln?.toLocaleString('pl-PL')} zł · {m.offer.city}
                    </div>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '0.85rem' }}>
                <DeskOfferComparison
                  clientEmail={deskCase.client.email}
                  offers={(deskCase.client.matches || []).map((m) => ({
                    id: m.offer.id,
                    title: m.offer.title,
                    pricePln: m.offer.pricePln,
                    area: m.offer.area,
                    rooms: m.offer.rooms,
                    city: m.offer.city,
                    district: m.offer.district,
                    status: m.offer.status,
                    score: m.score,
                  }))}
                />
              </div>
            </>
          ) : (
            <>
              <p className="eos-desk-muted" style={{ fontSize: '0.85rem' }}>
                Kupujący pasujący do oferty ({data.matchingBuyers.length})
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                {data.matchingBuyers.map((b) => (
                  <li
                    key={b.clientId}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      borderTop: '1px solid var(--desk-line)',
                      padding: '0.45rem 0',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBuyers.includes(b.clientId)}
                      onChange={(e) =>
                        setSelectedBuyers((prev) =>
                          e.target.checked
                            ? [...prev, b.clientId]
                            : prev.filter((id) => id !== b.clientId),
                        )
                      }
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <div className="eos-desk-muted" style={{ fontSize: '0.78rem' }}>
                        {b.score}% · {b.temperature || 'WARM'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {offer ? (
                <button
                  type="button"
                  className="eos-desk-btn eos-desk-btn-primary"
                  style={{ marginTop: '0.55rem' }}
                  disabled={!selectedBuyers.length}
                  onClick={async () => {
                    const res = await fetch('/api/crm/radar/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ offerId: offer.id, buyerIds: selectedBuyers }),
                    });
                    const json = await res.json();
                    if (!res.ok) {
                      alert(json.error || 'Nie wysłano');
                      return;
                    }
                    await postOutcome('PRICE_CHANGED', { offerId: offer.id, sent: selectedBuyers.length });
                    alert('Wysłano dopasowania');
                  }}
                >
                  Wyślij do zaznaczonych (Radar)
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {section === 'DEAL' ? (
        <div style={{ marginTop: '0.9rem' }}>
          <p className="eos-desk-kicker">Negocjacja / Deal / Akt</p>
          {offer ? (
            <>
              <button
                type="button"
                className="eos-desk-btn eos-desk-btn-primary"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy('DEAL');
                  try {
                    const res = await fetch('/api/deals/init', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ offerId: offer.id }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || json.message || 'Nie utworzono dealu');
                    const dealId = json.deal?.id;
                    if (dealId) {
                      await fetch(`/api/desk/cases/${caseId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'link_deal', dealId }),
                      });
                      await postOutcome('BID_RECEIVED', { dealId, offerId: offer.id });
                      window.open(`/dealroom/${dealId}`, '_blank');
                    }
                    await load();
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Błąd');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                CREATE DEAL (Deal Room)
              </button>
              <button
                type="button"
                className="eos-desk-btn"
                style={{ marginTop: '0.45rem' }}
                onClick={() => postOutcome('DEAL_FINALIZED', { offerId: offer.id })}
              >
                Mark deal finalized → aftercare
              </button>
              <p className="eos-desk-muted" style={{ fontSize: '0.82rem', marginTop: '0.65rem' }}>
                Deal Room engine pozostaje istniejący — Desk tylko spina sprawę i otwiera panel.
              </p>
            </>
          ) : (
            <p className="eos-desk-muted">Najpierw powiąż ofertę ze sprawą.</p>
          )}
        </div>
      ) : null}

      {section === 'GUESTS' ? (
        <div style={{ marginTop: '0.9rem' }}>
          <p className="eos-desk-kicker">Open House / Aukcja → klient</p>
          {!guests ? (
            <p className="eos-desk-muted">Brak powiązanej oferty albo brak gości.</p>
          ) : (
            <>
              {(guests.guests || []).map((g, idx) => (
                <div
                  key={`g-${g.user.id}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    borderTop: '1px solid var(--desk-line)',
                    padding: '0.45rem 0',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{g.user.name || 'Gość OH'}</div>
                    <div className="eos-desk-muted">
                      {g.user.phone || g.user.email || `user #${g.user.id}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="eos-desk-btn eos-desk-btn-brass"
                    onClick={async () => {
                      const res = await fetch('/api/desk/convert-guest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          source: 'open_house',
                          userId: g.user.id,
                          offerId: offer?.id,
                          deskCaseId: caseId,
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok) {
                        alert(json.error || 'Błąd');
                        return;
                      }
                      alert(json.reusedClient ? 'Połączono z istniejącym klientem' : 'Utworzono klienta BUY');
                      onRefresh?.();
                    }}
                  >
                    + Client
                  </button>
                </div>
              ))}
              {(guests.bidders || []).map((b, idx) => (
                <div
                  key={`b-${b.user.id}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    borderTop: '1px solid var(--desk-line)',
                    padding: '0.45rem 0',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.user.name || 'Licytant'}</div>
                    <div className="eos-desk-muted">
                      {b.amount.toLocaleString('pl-PL')} zł · {b.user.phone || b.user.email || ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="eos-desk-btn eos-desk-btn-brass"
                    onClick={async () => {
                      const res = await fetch('/api/desk/convert-guest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          source: 'auction',
                          userId: b.user.id,
                          offerId: offer?.id,
                          deskCaseId: caseId,
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok) {
                        alert(json.error || 'Błąd');
                        return;
                      }
                      await postOutcome('BID_RECEIVED', { amount: b.amount, offerId: offer?.id });
                      alert('Licytant → klient BUY');
                    }}
                  >
                    + Client
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      {section === 'DEBRIEF' ? (
        <div style={{ marginTop: '0.9rem' }}>
          <p className="eos-desk-kicker">15 sekund po prezentacji</p>
          <select
            className="eos-desk-select"
            value={debrief.result}
            onChange={(e) => setDebrief((d) => ({ ...d, result: e.target.value }))}
          >
            <option value="interested">Interested</option>
            <option value="not_interested">Not interested</option>
            <option value="too_expensive">Too expensive</option>
            <option value="second_visit">Second visit</option>
            <option value="considering">Considering</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="eos-desk-select"
            style={{ marginTop: '0.45rem' }}
            value={debrief.nextAction || 'FOLLOW_UP'}
            onChange={(e) => setDebrief((d) => ({ ...d, nextAction: e.target.value }))}
          >
            <option value="CALL">CALL</option>
            <option value="SECOND_VISIT">SECOND VISIT</option>
            <option value="OFFER">OFFER</option>
            <option value="FOLLOW_UP">FOLLOW-UP</option>
          </select>
          <select
            className="eos-desk-select"
            style={{ marginTop: '0.45rem' }}
            value={debrief.temperature}
            onChange={(e) => setDebrief((d) => ({ ...d, temperature: e.target.value }))}
          >
            <option value="HOT">HOT</option>
            <option value="WARM">WARM</option>
            <option value="COLD">COLD</option>
          </select>
          <input
            className="eos-desk-input"
            style={{ marginTop: '0.45rem' }}
            type="datetime-local"
            value={debrief.nextActionAt}
            onChange={(e) => setDebrief((d) => ({ ...d, nextActionAt: e.target.value }))}
          />
          <button
            type="button"
            className="eos-desk-btn eos-desk-btn-primary"
            style={{ marginTop: '0.55rem' }}
            onClick={() =>
              postOutcome('PRESENTATION_COMPLETED', {
                debrief: true,
                result: debrief.result,
                temperature: debrief.temperature,
                nextAction: debrief.nextAction || 'Follow-up po prezentacji',
                nextActionAt: debrief.nextActionAt
                  ? new Date(debrief.nextActionAt).toISOString()
                  : undefined,
                offerId: offer?.id,
              })
            }
          >
            Zapisz debrief
          </button>
          <button
            type="button"
            className="eos-desk-btn"
            style={{ marginTop: '0.45rem', marginLeft: '0.35rem' }}
            onClick={() => postOutcome('PRESENTATION_COMPLETED', { debrief: false, offerId: offer?.id })}
          >
            Prezentacja bez debriefu (AT_RISK)
          </button>
        </div>
      ) : null}

      {section === 'TEMPLATES' ? (
        <div style={{ marginTop: '0.75rem' }}>
          {DESK_TEMPLATES.map((t) => (
            <details key={t.id} style={{ borderTop: '1px solid var(--desk-line)', padding: '0.45rem 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t.label}</summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--desk-font-ui)',
                  fontSize: '0.82rem',
                  margin: '0.45rem 0 0',
                }}
              >
                {t.body}
              </pre>
              {deskCase.client.email ? (
                <a
                  className="eos-desk-btn"
                  style={{ marginTop: '0.35rem' }}
                  href={`mailto:${deskCase.client.email}?subject=${encodeURIComponent(t.subject || t.label)}&body=${encodeURIComponent(t.body)}`}
                >
                  Otwórz w e-mail
                </a>
              ) : null}
            </details>
          ))}
        </div>
      ) : null}

      {section === 'TIMELINE' ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
          {data.timeline.map((item) => (
            <li
              key={item.id}
              style={{ borderTop: '1px solid var(--desk-line)', padding: '0.55rem 0', fontSize: '0.85rem' }}
            >
              <div className="eos-desk-muted" style={{ fontSize: '0.72rem' }}>
                {fmtWhen(item.at)} · {timelineKindLabel(item.kind) || labelDeskActivityKind(item.kind)}
              </div>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              {item.body ? <div className="eos-desk-muted">{item.body}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <DeskIframeDrawer
        open={drawer.open}
        title={drawer.title}
        src={drawer.src}
        onClose={() => {
          setDrawer((d) => ({ ...d, open: false }));
          void load();
          onRefresh?.();
        }}
      />
    </div>
  );
}
