import { prisma } from '@/lib/prisma';
import { buildClientVoice, plPlural } from '@/lib/crm/clientVoice';
import { parsePortalPermissions } from '@/lib/crm/portalAccess';
import { favoriteBadge, parseFavoriteSnapshot } from '@/lib/crm/portalFavorites';
import { loadListingStats, loadShowingFeedbackSummary } from '@/lib/crm/sellerPortal';

/**
 * Tygodniowe podsumowanie w imieniu agenta (piątek rano).
 * Każdy mail trafia do „Do wysłania” (kategoria digest) — agent może włączyć automat.
 * Klient bez żadnych zmian w tygodniu nie dostaje nic.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function runWeeklyDigest(): Promise<{ scanned: number; queued: number }> {
  const since = new Date(Date.now() - WEEK_MS);
  const clients = await prisma.agencyClient.findMany({
    where: { status: 'ACTIVE', portalToken: { not: null }, email: { not: null } },
    select: {
      id: true,
      type: true,
      firstName: true,
      salutation: true,
      email: true,
      portalToken: true,
      portalPermissions: true,
      agencyUserId: true,
      linkedOfferId: true,
      agencyUser: { select: { name: true, companyName: true, email: true } },
    },
    take: 3000,
  });
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  let queued = 0;
  for (const c of clients) {
    if (!parsePortalPermissions(c.portalPermissions).weeklyDigest) continue;
    const recent = await prisma.agencyClientActivity.findFirst({
      where: { clientId: c.id, kind: 'WEEKLY_DIGEST', createdAt: { gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } },
      select: { id: true },
    });
    if (recent) continue;
    const voice = buildClientVoice({ clientId: c.id, firstName: c.firstName, salutation: c.salutation, agentName: c.agencyUser?.name });
    const { a, c: g } = voice;
    const lines: string[] = [];
    let next = '';

    if (c.type === 'BUYER') {
      const [newOffers, waiting, favorites, viewing] = await Promise.all([
        prisma.agencyClientMatch.count({ where: { clientId: c.id, notifiedAt: { gte: since } } }),
        prisma.agencyClientMatch.count({ where: { clientId: c.id, notifiedAt: { not: null }, clientFeedback: null } }),
        prisma.agencyClientMatch.findMany({
          where: { clientId: c.id, clientFavorite: true },
          select: { favoriteSnapshot: true, offer: { select: { title: true, price: true, status: true, images: true } } },
          take: 20,
        }),
        prisma.agencyClientActivity.count({ where: { clientId: c.id, kind: 'PRESENTATION_HELD', createdAt: { gte: since } } }),
      ]);
      if (newOffers) lines.push(`${a('Wysłałem', 'Wysłałam')} ${newOffers} ${plPlural(newOffers, 'nową propozycję', 'nowe propozycje', 'nowych propozycji')}.`);
      for (const f of favorites) {
        const badge = favoriteBadge(parseFavoriteSnapshot(f.favoriteSnapshot), f.offer);
        if (badge) lines.push(`Ulubione — „${f.offer.title}”: ${badge.toLowerCase()}.`);
      }
      if (viewing) lines.push(`${viewing === 1 ? 'Za nami jedno oglądanie' : `Za nami ${viewing} ${plPlural(viewing, 'oglądanie', 'oglądania', 'oglądań')}`}.`);
      next = waiting
        ? `${g('Na Pani ocenę', 'Na Pana ocenę', 'Na ocenę')} ${waiting === 1 ? 'czeka jeszcze 1 propozycja' : `${plPlural(waiting, 'czeka', 'czekają', 'czeka')} jeszcze ${waiting} ${plPlural(waiting, 'propozycja', 'propozycje', 'propozycji')}`} — każda odpowiedź pomaga mi szukać trafniej.`
        : 'W przyszłym tygodniu szukam dalej — dam znać, gdy pojawi się coś wartego uwagi.';
    } else {
      const stats = await loadListingStats(c.id, c.linkedOfferId);
      const feedback = await loadShowingFeedbackSummary(c.id);
      const weekShowings = await prisma.sellerShowingFeedback.count({ where: { clientId: c.id, createdAt: { gte: since } } });
      const weekViews = c.linkedOfferId
        ? await prisma.offerViewLog.count({ where: { offerId: c.linkedOfferId, lastSeenAt: { gte: since } } }).catch(() => 0)
        : 0;
      const openOffers = await prisma.sellerBuyerOffer.count({ where: { clientId: c.id, status: 'OPEN' } });
      if (weekViews) lines.push(`Ogłoszenie obejrzało w tym tygodniu ${weekViews} ${plPlural(weekViews, 'osoba', 'osoby', 'osób')} (łącznie ${stats?.views ?? weekViews}).`);
      if (weekShowings) lines.push(`${weekShowings === 1 ? 'Odbyło się 1 oglądanie' : `${plPlural(weekShowings, 'Odbyło', 'Odbyły', 'Odbyło')} się ${weekShowings} ${plPlural(weekShowings, 'oglądanie', 'oglądania', 'oglądań')}`}.`);
      const top = feedback.items[0];
      if (top) lines.push(`Najczęstsza uwaga kupujących: „${top.tag.toLowerCase()}”.`);
      if (openOffers) lines.push(`${openOffers === 1 ? 'Czeka 1 oferta kupującego' : `${plPlural(openOffers, 'Czeka', 'Czekają', 'Czeka')} ${openOffers} ${plPlural(openOffers, 'oferta', 'oferty', 'ofert')} kupujących`} — szczegóły w panelu.`);
      next = 'W przyszłym tygodniu kontynuuję promocję i umawiam kolejne oglądania.';
    }
    if (!lines.length) continue;

    const portalUrl = c.portalToken ? buildPortalUrl(c.portalToken) : null;
    const html = await buildClientMessageEmailHtml({
      agencyUserId: c.agencyUserId,
      client: c,
      eyebrow: 'Podsumowanie tygodnia',
      title: c.type === 'BUYER' ? 'Twoje poszukiwania w tym tygodniu' : 'Twoja sprzedaż w tym tygodniu',
      paragraphs: [voice.pick('digest-intro', ['Krótko o tym, co wydarzyło się w tym tygodniu:', 'Tak wyglądał ten tydzień:', 'Kilka słów podsumowania:'], new Date().toISOString().slice(0, 10))],
      bullets: lines,
      closing: next,
      ctas: portalUrl ? [{ label: 'Otwórz panel', href: portalUrl }] : [],
    });
    const delivery = await deliverToClient({
      agencyUserId: c.agencyUserId,
      clientId: c.id,
      category: 'digest',
      source: 'weekly_digest',
      steps: [emailStep({ to: c.email as string, subject: 'Podsumowanie tygodnia', html, replyTo: c.agencyUser?.email || undefined })],
    }).catch(() => null);
    await prisma.agencyClientActivity.create({
      data: {
        clientId: c.id,
        agencyUserId: c.agencyUserId,
        kind: 'WEEKLY_DIGEST',
        title: delivery?.queued ? 'Podsumowanie tygodnia czeka na akceptację' : 'Wysłano podsumowanie tygodnia',
        body: lines.join('\n'),
        metadata: { outboxId: delivery?.outboxId ?? null },
      },
    });
    queued += 1;
  }
  return { scanned: clients.length, queued };
}
