'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  Briefcase,
  Clock,
  Loader2,
  Star,
  X,
} from 'lucide-react';
import ProfileMediaAvatar from '@/components/profile/ProfileMediaAvatar';
import { formatAgentTitle, pickTeamMemberAvatar } from '@/lib/agentProfile';

type MemberSummary = {
  id: number;
  userId: number;
  role: string;
  agentTitle: string;
  profilePhotoUrl: string | null;
  user: {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
    lastLoginAt: string | null;
    activeOffers: number;
    pendingOffers: number;
    soldOffers: number;
    inDealOffers: number;
    dealsInProgress: number;
    crmClients: number;
    reviewsCount: number;
    averageRating: number | null;
    extraListings: number;
  };
};

type InsightsPayload = {
  offers: Array<{
    id: number;
    title: string;
    status: string;
    city: string;
    district: string | null;
    updatedAt: string;
  }>;
  clients: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
    updatedAt: string;
  }>;
  activities: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
    clientName: string | null;
  }>;
};

type TransferTarget = { userId: number; name: string | null };

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'Aktywna',
    PENDING: 'Oczekuje',
    SOLD: 'Sprzedana',
    IN_DEAL: 'W transakcji',
  };
  return map[status] || status;
}

export default function AgencyMemberDetailPanel({
  member,
  transferTargets,
  onClose,
  onTransferred,
}: {
  member: MemberSummary;
  transferTargets: TransferTarget[];
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [error, setError] = useState('');
  const [selectedOfferIds, setSelectedOfferIds] = useState<number[]>([]);
  const [transferTo, setTransferTo] = useState<number | ''>('');
  const [transferBusy, setTransferBusy] = useState(false);

  const transferableOffers = useMemo(
    () => (insights?.offers || []).filter((o) => ['ACTIVE', 'PENDING', 'IN_DEAL'].includes(o.status)),
    [insights],
  );

  const targets = transferTargets.filter((t) => t.userId !== member.userId);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/agency-company/members/${member.id}/insights`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.message || 'Nie udało się wczytać danych agenta.');
          return;
        }
        setInsights(data);
      })
      .catch(() => setError('Błąd połączenia.'))
      .finally(() => setLoading(false));
  }, [member.id]);

  const toggleOffer = (id: number) => {
    setSelectedOfferIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleTransfer = async () => {
    if (!transferTo || !selectedOfferIds.length) {
      setError('Wybierz agenta docelowego i co najmniej jedną ofertę.');
      return;
    }
    setTransferBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agency-company/offers/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: member.userId,
          toUserId: transferTo,
          offerIds: selectedOfferIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Transfer nie powiódł się.');
        return;
      }
      setSelectedOfferIds([]);
      setTransferTo('');
      onTransferred();
      onClose();
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setTransferBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 eos-z-drawer flex justify-end bg-black/50 p-0 sm:p-4">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[var(--eos-border)] bg-[var(--eos-bg)] shadow-2xl sm:rounded-l-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--eos-border)] p-5">
          <div className="flex items-center gap-4">
            <div className="size-14 overflow-hidden rounded-2xl border border-[var(--eos-border)]">
              <ProfileMediaAvatar
                src={pickTeamMemberAvatar({ userImage: member.user.image, profilePhotoUrl: member.profilePhotoUrl })}
                alt={member.user.name || ''}
                className="size-full object-cover"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                {formatAgentTitle(member.agentTitle)}
              </p>
              <h2 className="text-xl font-black text-[var(--eos-text)]">{member.user.name || member.user.email}</h2>
              <p className="eos-muted-copy text-xs">{member.user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Aktywne', value: member.user.activeOffers },
                  { label: 'Oczekujące', value: member.user.pendingOffers },
                  { label: 'Sprzedane', value: member.user.soldOffers },
                  { label: 'CRM', value: member.user.crmClients },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2">
                    <p className="text-lg font-black text-[var(--eos-text)]">{kpi.value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{kpi.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 text-sm">
                <div className="flex items-center gap-2 text-[var(--eos-muted)]">
                  <Clock size={14} /> Ostatnie logowanie:{' '}
                  <strong className="text-[var(--eos-text)]">{fmtDate(member.user.lastLoginAt)}</strong>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[var(--eos-muted)]">
                  <Briefcase size={14} /> Transakcje w toku:{' '}
                  <strong className="text-[var(--eos-text)]">{member.user.dealsInProgress}</strong>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[var(--eos-muted)]">
                  <Star size={14} className="text-amber-400" /> Opinie:{' '}
                  <strong className="text-[var(--eos-text)]">
                    {member.user.averageRating != null ? member.user.averageRating.toFixed(1) : '—'} ({member.user.reviewsCount})
                  </strong>
                </div>
                <Link href={`/profil/${member.user.id}`} className="mt-3 inline-block text-xs font-bold text-emerald-500 hover:underline">
                  Publiczny profil agenta →
                </Link>
              </div>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--eos-text)]">Ogłoszenia agenta</h3>
                {transferableOffers.length === 0 ? (
                  <p className="eos-muted-copy text-sm">Brak ogłoszeń do przeniesienia.</p>
                ) : (
                  <div className="space-y-2">
                    {transferableOffers.map((offer) => (
                      <label
                        key={offer.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-3 hover:border-emerald-500/30"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOfferIds.includes(offer.id)}
                          onChange={() => toggleOffer(offer.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-[var(--eos-text)]">{offer.title}</p>
                          <p className="eos-muted-copy text-xs">
                            {offer.city}
                            {offer.district ? `, ${offer.district}` : ''} · {statusLabel(offer.status)}
                          </p>
                        </div>
                        <Link
                          href={`/oferta/${offer.id}`}
                          className="shrink-0 text-[10px] font-bold text-emerald-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Podgląd
                        </Link>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {selectedOfferIds.length > 0 && targets.length > 0 && (
                <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--eos-text)]">
                    <ArrowRightLeft size={16} className="text-emerald-500" />
                    Przenieś {selectedOfferIds.length} ogłoszeń
                  </h3>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value ? Number(e.target.value) : '')}
                    className="eos-field mb-3 w-full text-sm"
                  >
                    <option value="">Wybierz agenta docelowego…</option>
                    {targets.map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.name || `Agent #${t.userId}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={transferBusy}
                    onClick={() => void handleTransfer()}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-2.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50"
                  >
                    {transferBusy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                    Przenieś ogłoszenia
                  </button>
                </section>
              )}

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--eos-text)]">Klienci CRM</h3>
                {(insights?.clients.length ?? 0) === 0 ? (
                  <p className="eos-muted-copy text-sm">Brak klientów w CRM.</p>
                ) : (
                  <div className="space-y-2">
                    {insights!.clients.slice(0, 8).map((client) => (
                      <div key={client.id} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-sm">
                        <p className="font-bold text-[var(--eos-text)]">{client.name}</p>
                        <p className="eos-muted-copy text-xs">
                          {client.type} · {client.status} · {fmtDate(client.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--eos-text)]">Ostatnia aktywność</h3>
                {(insights?.activities.length ?? 0) === 0 ? (
                  <p className="eos-muted-copy text-sm">Brak zarejestrowanej aktywności.</p>
                ) : (
                  <div className="space-y-2">
                    {insights!.activities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="rounded-xl border border-[var(--eos-border)]/70 px-3 py-2 text-sm">
                        <p className="font-semibold text-[var(--eos-text)]">{activity.title || activity.kind}</p>
                        {activity.body && <p className="eos-muted-copy text-xs">{activity.body}</p>}
                        <p className="mt-1 text-[10px] text-[var(--eos-muted)]">
                          {activity.clientName ? `${activity.clientName} · ` : ''}
                          {fmtDate(activity.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
