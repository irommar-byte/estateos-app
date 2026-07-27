import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeDiscoveryUpdated } from '../lib/discovery/clientEvents';
import {
  fetchDiscoveryProfile,
  type DiscoveryGuidePayload,
  type DiscoveryProfilePayload,
  type DiscoveryProfileTrope,
  type DiscoveryRecentEvent,
} from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';

function snapshotKey(input: {
  profile: DiscoveryProfilePayload | null;
  recent: DiscoveryRecentEvent[];
  guide: DiscoveryGuidePayload | null;
  tropes: DiscoveryProfileTrope[];
}) {
  return JSON.stringify({
    u: input.profile?.updatedAt,
    l: input.profile?.likesCount,
    d: input.profile?.dislikesCount,
    f: input.profile?.fastTrackCount,
    o: input.profile?.opensCount,
    c: input.profile?.confidence,
    g: input.guide?.intentStage,
    t: input.guide?.nextStep?.title,
    r: input.recent[0]?.id,
    tr: input.tropes.map((x) => `${x.offerId}:${x.updatedAt}`).join(','),
  });
}

export function useDiscoveryProfile(opts?: { onNewDecision?: (eventType: string) => void }) {
  const onNewDecision = opts?.onNewDecision;
  const token = useAuthStore((s) => s.token);
  const [auth, setAuth] = useState<'loading' | 'guest' | 'user'>('loading');
  const [profile, setProfile] = useState<DiscoveryProfilePayload | null>(null);
  const [tropes, setTropes] = useState<DiscoveryProfileTrope[]>([]);
  const [recent, setRecent] = useState<DiscoveryRecentEvent[]>([]);
  const [guide, setGuide] = useState<DiscoveryGuidePayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTopEventId = useRef<string | null>(null);
  const snapshotRef = useRef('');

  const load = useCallback(
    async (loadOpts?: { silent?: boolean; force?: boolean }) => {
      if (!loadOpts?.silent) setRefreshing(true);
      try {
        const data = await fetchDiscoveryProfile(token);
        if (data.auth === 'guest') {
          setAuth('guest');
          setProfile(null);
          setTropes([]);
          setRecent([]);
          setGuide(null);
          setError(null);
          return;
        }
        if (data.error && !data.profile) {
          if (!loadOpts?.silent) setError(data.error);
          setAuth('user');
          return;
        }

        const nextProfile = data.profile;
        const nextTropes = data.tropes;
        const nextRecent = data.recent;
        const nextGuide = data.guide;
        const nextKey = snapshotKey({
          profile: nextProfile,
          recent: nextRecent,
          guide: nextGuide,
          tropes: nextTropes,
        });

        const topId = nextRecent[0]?.id || null;
        if (
          loadOpts?.silent &&
          topId &&
          prevTopEventId.current &&
          topId !== prevTopEventId.current
        ) {
          onNewDecision?.(nextRecent[0].eventType);
        }
        if (topId) prevTopEventId.current = topId;

        if (!loadOpts?.force && nextKey === snapshotRef.current) {
          setAuth('user');
          setError(null);
          return;
        }

        snapshotRef.current = nextKey;
        setAuth('user');
        setProfile(nextProfile);
        setTropes(nextTropes);
        setRecent(nextRecent);
        setGuide(nextGuide);
        setError(null);
      } catch {
        if (!loadOpts?.silent) setError('Brak połączenia.');
      } finally {
        setRefreshing(false);
      }
    },
    [onNewDecision, token],
  );

  useEffect(() => {
    void load({ force: true });
  }, [load]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load({ silent: true })), [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load({ silent: true });
    });
    return () => sub.remove();
  }, [load]);

  return {
    auth,
    profile,
    tropes,
    recent,
    guide,
    refreshing,
    error,
    reload: load,
  };
}
