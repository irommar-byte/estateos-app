import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchOpenHouseTicker } from '../../services/openHouseService';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import OpenHouseLiveBanner from './OpenHouseLiveBanner';
import OpenHouseLivePanel from './OpenHouseLivePanel';

type Props = {
  enabled?: boolean;
};

export default function OpenHouseLiveOrchestrator({ enabled = true }: Props) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const items = useOpenHouseLiveStore((s) => s.items);
  const phase = useOpenHouseLiveStore((s) => s.phase);
  const panelOpen = useOpenHouseLiveStore((s) => s.panelOpen);
  const setItems = useOpenHouseLiveStore((s) => s.setItems);
  const showBanner = useOpenHouseLiveStore((s) => s.showBanner);
  const closePanel = useOpenHouseLiveStore((s) => s.closePanel);

  const topOffset = insets.top + 56;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const next = await fetchOpenHouseTicker(token);
      if (cancelled) return;
      setItems(next);
      if (next.length) {
        const st = useOpenHouseLiveStore.getState();
        if (st.phase === 'hidden' || st.phase === 'docked') {
          showBanner();
        }
      }
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
      {!panelOpen && (phase === 'entering' || phase === 'visible' || phase === 'genie') ? (
        <OpenHouseLiveBanner topOffset={topOffset} />
      ) : null}
      <OpenHouseLivePanel visible={panelOpen} onClose={closePanel} />
    </>
  );
}
