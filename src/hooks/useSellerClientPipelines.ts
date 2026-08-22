import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAcquisition,
  fetchAgencyClient,
  type AgencyClientListItem,
} from '../services/agencyClientService';
import { API_URL } from '../config/network';
import {
  sellerPipelineFromClientDetail,
  type SellerPipelineStage,
} from '../lib/sellerClientPipeline';

export type ClientPipelineMap = Record<number, SellerPipelineStage[]>;

async function fetchOfferStatus(token: string, offerId: number): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/offers/${offerId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return String(json?.offer?.status || json?.status || '').trim() || null;
  } catch {
    return null;
  }
}

async function enrichSellerClient(token: string, client: AgencyClientListItem) {
  const detailRes = await fetchAgencyClient(token, client.id);
  if (!detailRes.ok) return null;
  const acqRes = await fetchAcquisition(token, client.id);
  const acquisition = acqRes.ok ? acqRes.acquisition : null;
  let offerStatus: string | null = null;
  if (detailRes.client.linkedOfferId) {
    offerStatus = await fetchOfferStatus(token, detailRes.client.linkedOfferId);
  }
  const detailWithActivities = detailRes.client as typeof detailRes.client & {
    activities?: Array<{ kind: string; title: string | null; body: string | null }>;
  };
  return sellerPipelineFromClientDetail(detailWithActivities, acquisition, offerStatus);
}

export function useSellerClientPipelines(token: string | null, clients: AgencyClientListItem[]) {
  const [pipelines, setPipelines] = useState<ClientPipelineMap>({});
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const sellers = clients.filter((c) => c.type === 'SELLER');
    if (!sellers.length) {
      setPipelines({});
      return;
    }
    const request = ++seq.current;
    setLoading(true);
    try {
      const next: ClientPipelineMap = {};
      const batchSize = 3;
      for (let i = 0; i < sellers.length; i += batchSize) {
        const batch = sellers.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (client) => {
            const stages = await enrichSellerClient(token, client);
            return { id: client.id, stages };
          }),
        );
        if (request !== seq.current) return;
        for (const row of results) {
          if (row.stages) next[row.id] = row.stages;
        }
        setPipelines((prev) => ({ ...prev, ...next }));
      }
    } finally {
      if (request === seq.current) setLoading(false);
    }
  }, [clients, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { pipelines, loadingPipelines: loading, reloadPipelines: load };
}
