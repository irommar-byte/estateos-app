import { useMemo } from 'react';
import type { AgencyClientListItem } from '../services/agencyClientService';
import {
  sellerPipelineFromListItem,
  type SellerPipelineStage,
} from '../lib/sellerClientPipeline';

export type ClientPipelineMap = Record<number, SellerPipelineStage[]>;

export function useSellerClientPipelines(_token: string | null, clients: AgencyClientListItem[]) {
  const pipelines = useMemo(() => {
    const next: ClientPipelineMap = {};
    for (const client of clients) {
      if (client.type !== 'SELLER') continue;
      next[client.id] = sellerPipelineFromListItem(client);
    }
    return next;
  }, [clients]);

  const portalUrls = useMemo(() => {
    const urls: Record<number, string> = {};
    for (const client of clients) {
      if (client.portalUrl) urls[client.id] = client.portalUrl;
    }
    return urls;
  }, [clients]);

  return {
    pipelines,
    portalUrls,
    loadingPipelines: false,
    reloadPipelines: () => undefined,
  };
}
