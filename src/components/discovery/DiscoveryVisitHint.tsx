import React, { useEffect, useState } from 'react';
import DiscoveryIntelligenceWhisper from './DiscoveryIntelligenceWhisper';
import { fetchDiscoveryForYou } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { subscribeDiscoveryUpdated } from '../../lib/discovery/clientEvents';

type Props = {
  navigation?: any;
  offerId: number | string;
  style?: object;
  isDark?: boolean;
};

/**
 * Soft suggest / discourage visit — one line near offer CTAs.
 */
export default function DiscoveryVisitHint({ navigation, offerId, style, isDark }: Props) {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const [hint, setHint] = useState<{ body: string; href: string } | null>(null);

  useEffect(() => {
    if (!hydrated || !enabled || !token) {
      setHint(null);
      return;
    }
    const id = Number(offerId);
    if (!Number.isFinite(id) || id <= 0) return;
    let cancelled = false;

    const load = async () => {
      const data = await fetchDiscoveryForYou(token, { offerId: id, limit: 1 });
      if (cancelled || !data) return;
      const score = Number(data?.explain?.score);
      const ready = Boolean(data?.profile?.ready);
      if (!ready && !(Number.isFinite(score) && score > 0)) {
        setHint(null);
        return;
      }

      if (Number.isFinite(score) && score >= 55) {
        setHint({
          body: 'Ten trop dobrze rezonuje z Twoim kierunkiem — wizyta może być spokojnym następnym krokiem.',
          href: '/moj-kierunek',
        });
      } else if (Number.isFinite(score) && score > 0 && score < 22) {
        setHint({
          body: 'Słabe dopasowanie do dotychczasowych wyborów. Lepiej doprecyzować kierunek przed wizytą.',
          href: '/lustro',
        });
      } else if (data?.explain?.reason) {
        setHint({
          body: 'Warto spokojnie pogłębić ten trop przed kontaktem — bez pośpiechu.',
          href: '/moj-kierunek',
        });
      } else {
        setHint(null);
      }
    };

    void load();
    const unsub = subscribeDiscoveryUpdated(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [offerId, enabled, hydrated, token]);

  if (!hydrated || !enabled || !hint) return null;

  return (
    <DiscoveryIntelligenceWhisper
      navigation={navigation}
      variant="inline"
      body={hint.body}
      href={hint.href}
      style={style}
      isDark={isDark}
    />
  );
}
