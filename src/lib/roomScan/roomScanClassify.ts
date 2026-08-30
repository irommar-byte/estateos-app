import type { RoomScanObjectCategory } from '../../types/roomScan';

export function inferRoomTypeFromObjects(
  categories: RoomScanObjectCategory[],
  hint?: { areaSqM?: number; widthM?: number; lengthM?: number },
): string {
  const set = new Set(categories);
  const area = hint?.areaSqM || (hint?.widthM && hint?.lengthM ? hint.widthM * hint.lengthM : 0);
  const elongated =
    hint?.widthM && hint?.lengthM
      ? Math.max(hint.widthM, hint.lengthM) / Math.max(0.3, Math.min(hint.widthM, hint.lengthM)) > 2.35
      : false;
  const hasKitchen = set.has('stove') || set.has('oven') || set.has('dishwasher') || set.has('refrigerator');
  const hasLiving = set.has('sofa') || set.has('television') || set.has('fireplace');
  const hasBathFixture = set.has('toilet') || set.has('bathtub');

  if (set.has('bed') && !hasBathFixture) return 'bedroom';
  if (hasKitchen && hasLiving) return 'livingRoomKitchenette';
  if (hasKitchen) return 'kitchen';
  if (hasBathFixture && !set.has('bed')) return set.has('toilet') && !set.has('bathtub') ? 'wc' : 'bathroom';
  if (set.has('washerDryer') && !hasKitchen) return 'laundry';
  if (hasLiving) return 'livingRoom';
  if (set.has('table') && set.has('chair') && !hasKitchen) return 'diningRoom';
  if (set.has('sink') && !hasKitchen) {
    if (area > 14) return 'unspecified';
    return 'bathroom';
  }
  if (set.has('storage') && area > 0 && area < 6) return 'closet';
  if (!categories.length && elongated && area > 0 && area < 14) return 'hallway';
  if (!categories.length && area >= 8) return 'room';
  return 'unspecified';
}
