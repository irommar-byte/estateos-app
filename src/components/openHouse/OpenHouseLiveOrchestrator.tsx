import React from 'react';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import OpenHouseLiveBootstrap from './OpenHouseLiveBootstrap';
import OpenHouseLivePanel from './OpenHouseLivePanel';

type Props = {
  enabled?: boolean;
};

/** Dane Live w tle + panel (Modal) gdy otwarty. Ticker jest w tab barze. */
export default function OpenHouseLiveOrchestrator({ enabled = true }: Props) {
  const panelOpen = useOpenHouseLiveStore((s) => s.panelOpen);
  const closePanel = useOpenHouseLiveStore((s) => s.closePanel);

  return (
    <>
      <OpenHouseLiveBootstrap enabled={enabled} />
      {panelOpen ? <OpenHouseLivePanel visible onClose={closePanel} /> : null}
    </>
  );
}
