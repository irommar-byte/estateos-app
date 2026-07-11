export type TabBarTickerAction =
  | { type: 'offer'; offerId: number }
  | { type: 'open_house'; eventId: number; offerId: number }
  | { type: 'auction'; eventId: number; offerId: number }
  | { type: 'live_panel' }
  | { type: 'radar_calibration' }
  | { type: 'auction_hub' }
  | { type: 'open_house_hub' }
  | { type: 'pro_upsell'; reason: 'premium_tools' | 'auction' | 'open_house' };

export type TabBarTickerPriority = 'immediate' | 'info';

export type TabBarTickerMessage = {
  id: string;
  priority: TabBarTickerPriority;
  /** Treść przewijana — bez CTA. */
  bodyText: string;
  /** Etykieta przycisku akcji (np. „Sprawdź”). */
  ctaLabel: string;
  action: TabBarTickerAction;
  scrollPxPerSec?: number;
};

export type TabBarTickerPhase = 'idle' | 'opening' | 'scrolling' | 'closing';

export const TAB_BAR_INFO_INTERVAL_MS = 60_000;
