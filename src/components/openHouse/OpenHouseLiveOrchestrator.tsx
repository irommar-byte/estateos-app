import React from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import OpenHouseLiveBootstrap from './OpenHouseLiveBootstrap';
import OpenHouseLiveBanner from './OpenHouseLiveBanner';
import OpenHouseLivePanel from './OpenHouseLivePanel';

type Props = {
  enabled?: boolean;
};

const BANNER_PHASES = new Set(['hero', 'typing', 'genie']);
const BANNER_GAP_ABOVE_PILL = 10;

/** Dane Live w tle + animowany banner nad pigułką ofert + panel (Modal) gdy otwarty. */
export default function OpenHouseLiveOrchestrator({ enabled = true }: Props) {
  const insets = useSafeAreaInsets();
  const phase = useOpenHouseLiveStore((s) => s.phase);
  const panelOpen = useOpenHouseLiveStore((s) => s.panelOpen);
  const offerPillTopY = useOpenHouseLiveStore((s) => s.offerPillTopY);
  const closePanel = useOpenHouseLiveStore((s) => s.closePanel);

  const windowH = Dimensions.get('window').height;
  const fallbackPillTop = windowH - insets.bottom - 96;
  const pillTop = offerPillTopY > 0 ? offerPillTopY : fallbackPillTop;
  const bannerBottom = Math.max(insets.bottom + 72, windowH - pillTop + BANNER_GAP_ABOVE_PILL);

  return (
    <>
      <OpenHouseLiveBootstrap enabled={enabled} />
      {!panelOpen && BANNER_PHASES.has(phase) ? (
        <OpenHouseLiveBanner bottom={bannerBottom} />
      ) : null}
      {panelOpen ? <OpenHouseLivePanel visible onClose={closePanel} /> : null}
    </>
  );
}
