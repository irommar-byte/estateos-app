import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchMyOpenHouseReservations, fetchOpenHouseTicker } from '../../services/openHouseService';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import OpenHouseLiveBanner from './OpenHouseLiveBanner';
import OpenHouseLivePanel from './OpenHouseLivePanel';

type Props = {
  enabled?: boolean;
};

const BANNER_PHASES = new Set(['hero', 'typing', 'genie']);
const BANNER_GAP_ABOVE_PILL = 10;

export default function OpenHouseLiveOrchestrator({ enabled = true }: Props) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const phase = useOpenHouseLiveStore((s) => s.phase);
  const panelOpen = useOpenHouseLiveStore((s) => s.panelOpen);
  const offerPillTopY = useOpenHouseLiveStore((s) => s.offerPillTopY);
  const setItems = useOpenHouseLiveStore((s) => s.setItems);
  const setReservedEventIds = useOpenHouseLiveStore((s) => s.setReservedEventIds);
  const showBanner = useOpenHouseLiveStore((s) => s.showBanner);
  const closePanel = useOpenHouseLiveStore((s) => s.closePanel);

  const windowH = Dimensions.get('window').height;
  const fallbackPillTop = windowH - insets.bottom - 96;
  const pillTop = offerPillTopY > 0 ? offerPillTopY : fallbackPillTop;
  const bannerBottom = Math.max(insets.bottom + 72, windowH - pillTop + BANNER_GAP_ABOVE_PILL);

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

  return (
    <>
      {!panelOpen && BANNER_PHASES.has(phase) ? (
        <OpenHouseLiveBanner bottom={bannerBottom} />
      ) : null}
      <OpenHouseLivePanel visible={panelOpen} onClose={closePanel} />
    </>
  );
}
