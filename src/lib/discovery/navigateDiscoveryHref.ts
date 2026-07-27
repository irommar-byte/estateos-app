/**
 * Map WWW Discovery hrefs / pulse actions onto mobile stack routes.
 */
export function navigateDiscoveryHref(navigation: any, href?: string | null, action?: string | null) {
  const act = String(action || '').trim().toUpperCase();
  if (act === 'TROPES') {
    navigation?.navigate?.('DiscoveryTropes');
    return;
  }
  if (act === 'LUSTRO' || act === 'PROFILE') {
    navigation?.navigate?.('DiscoveryLustro');
    return;
  }
  if (act === 'DIRECTION') {
    navigation?.navigate?.('DiscoveryDirection');
    return;
  }
  if (act === 'MAP') {
    navigation?.navigate?.('MainTabs', { screen: 'Explore' });
    return;
  }
  if (act === 'CONTACT') {
    navigation?.navigate?.('MainTabs', { screen: 'Wiadomości' });
    return;
  }
  if (act === 'DISCOVERY') {
    navigation?.navigate?.('EstateDiscovery');
    return;
  }

  const path = String(href || '').trim();
  if (!path) {
    navigation?.navigate?.('DiscoveryDirection');
    return;
  }

  const offerMatch = path.match(/\/oferta\/(\d+)/i);
  if (offerMatch) {
    navigation?.navigate?.('OfferDetail', { offerId: Number(offerMatch[1]) });
    return;
  }
  if (path.includes('/lustro')) {
    navigation?.navigate?.('DiscoveryLustro');
    return;
  }
  if (path.includes('/moj-kierunek')) {
    navigation?.navigate?.('DiscoveryDirection');
    return;
  }
  if (path.includes('/odkryj') || path.includes('/mapa')) {
    navigation?.navigate?.('MainTabs', { screen: 'Explore' });
    return;
  }
  if (path.includes('/wiadomosc') || path.includes('/contact')) {
    navigation?.navigate?.('MainTabs', { screen: 'Wiadomości' });
    return;
  }
  if (path.includes('/oferty') || path.includes('/katalog')) {
    navigation?.navigate?.('MainTabs', { screen: 'Market' });
    return;
  }
  if (path.includes('/trop')) {
    navigation?.navigate?.('DiscoveryTropes');
    return;
  }

  navigation?.navigate?.('DiscoveryDirection');
}
