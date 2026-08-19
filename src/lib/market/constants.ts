export const RCN_WFS_URL = 'https://mapy.geoportal.gov.pl/wss/service/rcn';
export const RCN_SOURCE_LABEL = 'GUGiK — Rejestr Cen Nieruchomości';
export const RCN_ATTRIBUTION =
  'Źródło: Główny Urząd Geodezji i Kartografii, Rejestr Cen Nieruchomości. Opracowanie własne EstateOS™. To nie jest operat szacunkowy rzeczoznawcy.';

export const WARSAW_TERYT_PREFIX = '1465';
export const WARSAW_CITY = 'Warszawa';

export const MARKET_KIND_LOCAL = 'LOCAL';
export const MARKET_FUNCTION_RESIDENTIAL = 'mieszkalna';

/** Domyślne okno comps — akty spływają z opóźnieniem. */
export const DEFAULT_COMPS_MONTHS = 12;
export const FALLBACK_COMPS_MONTHS = 24;
export const INGEST_MONTHS = 36;

export const COMPS_RADIUS_STEPS_M = [400, 800, 1500, 2500];
export const COMPS_MIN_COUNT = 8;
export const COMPS_TARGET_COUNT = 16;
export const COMPS_MAX_RETURN = 24;
export const AREA_TOLERANCE = 0.15;
export const ROOMS_TOLERANCE = 1;

export const QUALITY_MIN_AREA = 15;
export const QUALITY_MAX_AREA = 250;
export const QUALITY_MIN_PRICE = 80_000;
export const QUALITY_MAX_PRICE = 12_000_000;
export const QUALITY_MIN_PPSM = 4_000;
export const QUALITY_MAX_PPSM = 55_000;

export const MARKET_REPORT_STRIPE_AMOUNT = 4900;
export const MARKET_REPORT_CREDIT_PRODUCT = 'estateos_market_report';

export const PRO_REPORT_DAILY_CAP = 20;
export const VALUATION_RATE_LIMIT_PER_10MIN = 40;
