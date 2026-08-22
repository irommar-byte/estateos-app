'use client';

import { useEffect, useState } from 'react';
import type { OfferImageMetaPublic } from '@/lib/upload/offerImageMeta';

export function useOfferImageMeta(offerId?: number | string | null) {
  const [meta, setMeta] = useState<Record<string, OfferImageMetaPublic>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!offerId) {
      setMeta({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/public/offers/${offerId}/images-meta`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.images) setMeta(json.images as Record<string, OfferImageMetaPublic>);
      })
      .catch(() => {
        if (!cancelled) setMeta({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  return { meta, loading, isHdr: (url: string) => Boolean(meta[url]?.isHdr) };
}
