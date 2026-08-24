import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { onCrmClientsChanged } from '../lib/crmClientsEvents';

export type CrmScheduleKind = 'presentation' | 'open_house_host' | 'open_house_guest' | 'acquisition';

export type CrmScheduleEvent = {
  id: string;
  kind: CrmScheduleKind;
  title: string;
  subtitle?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  status?: 'confirmed' | 'pending' | null;
  href?: string | null;
};

export function crmKindColor(kind: CrmScheduleKind) {
  if (kind === 'acquisition') return '#007AFF';
  if (kind === 'presentation') return '#AF52DE';
  return '#34C759';
}

export function crmKindLabel(kind: CrmScheduleKind) {
  if (kind === 'acquisition') return 'POZYSKANIE KLIENTA';
  if (kind === 'presentation') return 'PREZENTACJA';
  return 'DZIEŃ OTWARTY';
}

/** Client id encoded in the web href (`?clientId=12`) so mobile can deep-link to the CRM card. */
export function crmEventClientId(event: CrmScheduleEvent): number | null {
  const match = /clientId=(\d+)/.exec(String(event.href || ''));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export function useCrmSchedule(pollMs = 60000) {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<CrmScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setEvents([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/pro-widget/schedule`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.events)) setEvents(data.events as CrmScheduleEvent[]);
    } catch {
      /* offline: keep last known schedule */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), pollMs);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    const crmSub = onCrmClientsChanged((detail) => {
      const archived = (detail.archivedIds || []).filter((id) => Number.isFinite(id) && id > 0);
      if (archived.length) {
        const drop = new Set(archived);
        setEvents((prev) =>
          prev.filter((event) => {
            const clientId = crmEventClientId(event);
            return clientId == null || !drop.has(clientId);
          }),
        );
      }
      void load();
    });
    return () => {
      clearInterval(interval);
      appSub.remove();
      crmSub.remove();
    };
  }, [load, pollMs]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { events, loading, reload: load };
}
