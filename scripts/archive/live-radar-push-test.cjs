#!/usr/bin/env node
/**
 * Live prod smoke: archive → reactivate offer → radar push.
 * Usage: node scripts/live-radar-push-test.cjs [--offer-id=238] [--dry-run]
 */
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const { Expo } = require('expo-server-sdk');

const prisma = new PrismaClient();
const expo = new Expo();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const offerArg = args.find((a) => a.startsWith('--offer-id='));
const offerId = offerArg ? Number(offerArg.split('=')[1]) : 238;

function clampScore(v) {
  return Math.max(0, Math.min(100, v));
}

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function canonicalizeCity(city) {
  const c = normalizeText(city);
  if (c.includes('kalwaria')) return 'kalwaria zebrzydowska';
  return c;
}

function citiesMatch(prefCity, offerCity) {
  const a = normalizeText(canonicalizeCity(prefCity) || prefCity);
  const b = normalizeText(canonicalizeCity(offerCity) || offerCity);
  if (!a || !b) return true;
  return a === b;
}

function getPricePln(offer) {
  const pln = Number(offer.pricePln);
  if (Number.isFinite(pln) && pln > 0) return pln;
  return Number(offer.price) || 0;
}

function calculateScore(pref, offer) {
  const txPref = String(pref.transactionType || '').toUpperCase();
  const txOffer = String(offer.transactionType || '').toUpperCase();
  if (txPref && txOffer && txPref !== txOffer) return 0;

  if (pref.city && offer.city && !citiesMatch(pref.city, offer.city)) return 0;

  const propPref = String(pref.propertyType || '').toUpperCase();
  if (propPref && propPref !== 'ALL') {
    const propOffer = String(offer.propertyType || '').toUpperCase();
    if (propOffer && propPref !== propOffer) return 0;
  }

  const price = getPricePln(offer);
  const maxPrice = Number(pref.maxPrice || 0);
  const priceScore =
    !maxPrice || price <= maxPrice
      ? 100
      : clampScore((maxPrice / Math.max(1, price)) * 60);

  const area = Number(offer.area || 0);
  const minArea = Number(pref.minArea || 0);
  const areaScore =
    !minArea || area >= minArea
      ? 100
      : clampScore((area / Math.max(1, minArea)) * 60);

  const locationScore = 100;
  const total =
    30 * locationScore + 25 * priceScore + 15 * areaScore + 10 * 100 + 20 * 100;
  return clampScore(total / 100);
}

function threshold(pref) {
  return Math.max(50, Math.min(100, Number(pref.minMatchThreshold ?? 70)));
}

async function sendRadarPush(userId, offer, score, publicationId) {
  const idempotencyKey = `radar_match:offer:${offer.id}:pub:${publicationId}:user:${userId}`;
  const title =
    score >= 85 ? '💎 Idealne trafienie' : score >= 70 ? '🔥 Świeża okazja' : '🎯 Właśnie wpadła';
  const body = `${offer.title} • ${getPricePln(offer).toLocaleString('pl-PL')} PLN`;

  let notification;
  try {
    notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: 'AI_RADAR',
        status: 'PENDING',
        idempotencyKey,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.log(`⏭ duplicate idempotency ${idempotencyKey}`);
      return { skipped: true };
    }
    throw error;
  }

  const devices = await prisma.device.findMany({
    where: { userId, isActive: true },
    select: { expoPushToken: true },
  });
  const tokens = devices
    .map((d) => d.expoPushToken)
    .filter((t) => Expo.isExpoPushToken(t));
  if (!tokens.length) throw new Error(`NO_TOKENS user ${userId}`);

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: {
      targetType: 'OFFER',
      targetId: String(offer.id),
      offerId: offer.id,
      notificationType: 'radar_match',
      screen: 'OfferDetail',
      route: 'OfferDetail',
      deeplink: `estateos://offer/${offer.id}`,
    },
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const ticketIds = [];
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    ticketIds.push(...tickets.map((t) => t.id).filter(Boolean));
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: 'SENT', sentAt: new Date() },
  });

  return { notificationId: notification.id, ticketIds, userId, score };
}

async function reactivateOffer(oid) {
  const offer = await prisma.offer.findUnique({ where: { id: oid } });
  if (!offer) throw new Error('OFFER_NOT_FOUND');

  const ownerId = offer.userId;
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$executeRawUnsafe(
    `UPDATE OfferPublication SET status = 'ENDED', endedAt = NOW(3), endReason = 'ADMIN' WHERE offerId = ? AND status = 'ACTIVE'`,
    oid,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO OfferPublication (offerId, userId, kind, status, startedAt, endsAt, iapTransactionId, iapProductId)
     VALUES (?, ?, 'PLUS_CREDIT', 'ACTIVE', NOW(3), ?, NULL, NULL)`,
    oid,
    ownerId,
    endsAt,
  );

  const pubRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM OfferPublication WHERE offerId = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
    oid,
  );
  const publicationId = pubRows[0]?.id?.toString?.() ?? String(pubRows[0]?.id);

  await prisma.offer.update({
    where: { id: oid },
    data: { status: 'ACTIVE', expiresAt: endsAt, updatedAt: new Date() },
  });

  return { offer, publicationId };
}

async function main() {
  console.log(`\n🔭 LIVE RADAR TEST offer=${offerId} dryRun=${dryRun}\n`);

  const prefs = await prisma.radarPreference.findMany({ where: { pushNotifications: true } });
  console.log(`Prefs with push: ${prefs.length}`);

  let offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error('Offer not found');

  console.log(`Offer ${offer.id}: ${offer.city} ${offer.transactionType} owner=${offer.userId} status=${offer.status}`);

  const candidates = [];
  for (const pref of prefs) {
    const userId = Number(pref.userId);
    if (userId === offer.userId) continue;
    const score = calculateScore(pref, offer);
    const th = threshold(pref);
    console.log(`  user ${userId}: score=${score} threshold=${th} city=${pref.city} tx=${pref.transactionType}`);
    if (score >= th) candidates.push({ userId, score, pref });
  }

  if (!candidates.length) {
    console.log('\n❌ Brak kandydatów do push — sprawdź kalibrację vs ofertę.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n✅ Dry-run OK — kandydaci:', candidates.map((c) => c.userId).join(', '));
    return;
  }

  if (offer.status !== 'ACTIVE') {
    console.log('Reaktywacja oferty…');
    const reactivated = await reactivateOffer(offerId);
    offer = reactivated.offer;
    var publicationId = reactivated.publicationId;
  } else {
    console.log('Oferta już ACTIVE — symulacja nowej sesji publikacji…');
    const reactivated = await reactivateOffer(offerId);
    offer = reactivated.offer;
    var publicationId = reactivated.publicationId;
  }

  console.log(`Nowa publikacja id=${publicationId}`);

  const results = [];
  for (const c of candidates) {
    try {
      const r = await sendRadarPush(c.userId, offer, c.score, publicationId);
      results.push(r);
      console.log(`🚀 PUSH user ${c.userId}:`, r);
    } catch (e) {
      console.error(`❌ user ${c.userId}:`, e.message || e);
    }
  }

  console.log('\n📊 Podsumowanie:', JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
