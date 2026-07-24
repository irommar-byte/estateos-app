import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import type { CarListingRecord } from '@/lib/carsStorage';
import {
  listPushEnabledCarRadarPreferences,
  type CarRadarPreferenceRecord,
} from '@/lib/carRadarStorage';

function normalizeLabel(value: string) {
  return String(value || '').trim().toLowerCase();
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

/** Hard filters must pass; score reflects how many criteria were set and matched. */
export function calculateCarRadarMatchScore(
  pref: CarRadarPreferenceRecord,
  car: CarListingRecord,
): number {
  let criteria = 0;
  let matched = 0;

  const check = (active: boolean, ok: boolean) => {
    if (!active) return true;
    criteria += 1;
    if (ok) matched += 1;
    return ok;
  };

  if (!check(!!pref.vehicleType, normalizeLabel(car.vehicleType || 'car') === normalizeLabel(pref.vehicleType))) {
    return 0;
  }
  if (!check(!!pref.make, normalizeLabel(car.make) === normalizeLabel(pref.make))) return 0;
  if (!check(!!pref.model, normalizeLabel(car.model) === normalizeLabel(pref.model))) return 0;
  if (pref.generation) {
    const carGeneration = String(car.generation || '').trim();
    const ok =
      (carGeneration && normalizeLabel(carGeneration) === normalizeLabel(pref.generation)) ||
      (!carGeneration &&
        normalizeLabel([car.make, car.model, car.title].join(' ')).includes(normalizeLabel(pref.generation)));
    if (!check(true, ok)) return 0;
  }
  if (!check(!!pref.fuelType, car.fuelType === pref.fuelType)) return 0;
  if (!check(!!pref.bodyType, car.bodyType === pref.bodyType)) return 0;
  if (
    !check(
      !!pref.exteriorColor,
      normalizeLabel(car.exteriorColor || '') === normalizeLabel(pref.exteriorColor),
    )
  ) {
    return 0;
  }
  if (!check(!!pref.transmission, car.transmission === pref.transmission)) return 0;
  if (!check(!!pref.city, normalizeLabel(car.city).includes(normalizeLabel(pref.city)))) return 0;
  if (!check(pref.minPrice != null, car.pricePln >= Number(pref.minPrice))) return 0;
  if (!check(pref.maxPrice != null, car.pricePln <= Number(pref.maxPrice))) return 0;
  if (!check(pref.minYear != null, car.year >= Number(pref.minYear))) return 0;
  if (!check(pref.maxYear != null, car.year <= Number(pref.maxYear))) return 0;
  if (!check(pref.minMileage != null, car.mileageKm >= Number(pref.minMileage))) return 0;
  if (!check(pref.maxMileage != null, car.mileageKm <= Number(pref.maxMileage))) return 0;

  if (pref.lat != null && pref.lng != null && pref.radius != null && pref.radius > 0) {
    const lat = Number(car.cityLat);
    const lng = Number(car.cityLng);
    const ok =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      distanceKm(pref.lat, pref.lng, lat, lng) <= pref.radius;
    if (!check(true, ok)) return 0;
  }

  if (pref.queryText) {
    const q = normalizeLabel(pref.queryText);
    const haystack = normalizeLabel(
      [car.title, car.make, car.model, car.city, car.fuelType, car.exteriorColor, car.bodyType, car.generation, car.description]
        .filter(Boolean)
        .join(' '),
    );
    if (!check(true, haystack.includes(q))) return 0;
  }

  if (criteria === 0) return 100;
  return Math.round((matched / criteria) * 100);
}

function idempotencyKey(carId: number, userId: number) {
  return `car_radar_match:car:${carId}:user:${userId}`;
}

export const carRadarService = {
  async notifyForNewCar(car: CarListingRecord) {
    const carId = Number(car.id);
    const ownerId = Number(car.userId);
    console.log(`[CAR_RADAR] Matching for car ${carId} (${car.title})`);

    const prefs = await listPushEnabledCarRadarPreferences();
    console.log(`[CAR_RADAR] Found ${prefs.length} preferences with push enabled`);

    const sendTasks: Array<Promise<void>> = [];
    let matchCount = 0;

    for (const pref of prefs) {
      const userId = Number(pref.userId);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      if (Number.isFinite(ownerId) && ownerId > 0 && userId === ownerId) continue;

      const score = calculateCarRadarMatchScore(pref, car);
      const threshold = Number.isFinite(pref.minMatchThreshold) ? pref.minMatchThreshold : 70;
      if (score < threshold) {
        console.log(`[CAR_RADAR] SKIP user ${userId} score=${score} threshold=${threshold}`);
        continue;
      }

      const activeDeviceCount = await prisma.device.count({
        where: { userId, isActive: true },
      });
      if (activeDeviceCount < 1) {
        console.warn(`[CAR_RADAR] SKIP user ${userId} — NO_ACTIVE_DEVICES`);
        continue;
      }

      matchCount += 1;
      const priceLabel = Number(car.pricePln || 0).toLocaleString('pl-PL');
      sendTasks.push(
        sendNotification({
          userId,
          type: 'RADAR_MATCH',
          title: score >= 85 ? '💎 Idealne auto' : score >= 70 ? '🔥 Świeże auto' : '🎯 Auto na radarze',
          body: `${car.title} • ${priceLabel} PLN`,
          data: {
            targetType: 'CAR',
            targetId: String(carId),
            carId,
            notificationType: 'car_radar_match',
            screen: 'CarDetail',
            route: 'CarDetail',
            deeplink: `estateos://car/${carId}`,
          },
          idempotencyKey: idempotencyKey(carId, userId),
        }).then(() => undefined),
      );
    }

    await Promise.allSettled(sendTasks);
    console.log(`[CAR_RADAR] Processed. Total matches queued: ${matchCount}`);
  },
};
