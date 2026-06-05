import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchMyOpenHouseReservations, fetchOpenHouseTicker } from '../../services/openHouseService';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';

type Props = {
  enabled?: boolean;
};

/** Tylko efekty — bez widoku, żeby nie blokować dotyku na mapie. */
export default function OpenHouseLiveBootstrap({ enabled = true }: Props) {
  const token = useAuthStore((s) => s.token);
  const setItems = useOpenHouseLiveStore((s) => s.setItems);
  const setReservedEventIds = useOpenHouseLiveStore((s) => s.setReservedEventIds);
  const showBanner = useOpenHouseLiveStore((s) => s.showBanner);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const loadReservations = async () => {
      if (!token) {
        setReservedEventIds([]);
        return;
      }
      const rows = await fetchMyOpenHouseReservations(token);
      if (cancelled) return;
      setReservedEventIds(rows.map((r) => r.event.id));
    };

    void loadReservations();
  }, [enabled, token, setReservedEventIds]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const next = await fetchOpenHouseTicker(token);
      if (cancelled) return;
      setItems(next);
      if (next.length) showBanner();
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, token, setItems, showBanner]);

  return null;
}
