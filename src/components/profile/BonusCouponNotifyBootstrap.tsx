import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserProfilePromoCards } from '../../services/profilePromoService';
import { detectAndNotifyNewBonusCoupons } from '../../utils/bonusCouponNotification';

/** Wykrywa nowe kupony bonusowe po wejściu w aplikację i wysyła lokalny push. */
export default function BonusCouponNotifyBootstrap() {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!token || userId == null) return;

    let cancelled = false;
    const poll = async () => {
      const cards = await fetchUserProfilePromoCards(token, userId);
      if (!cancelled) {
        await detectAndNotifyNewBonusCoupons(userId, cards, t);
      }
    };

    void poll();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void poll();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [token, userId, t]);

  return null;
}
