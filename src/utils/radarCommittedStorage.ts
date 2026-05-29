import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RadarFilters } from '../components/RadarCalibrationModal';
import type { RadarMapBounds } from './radarPreferenceSync';

const STORAGE_KEY = '@estateos_radar_committed_v1';

export type RadarCommittedState = {
  userId: number;
  filters: RadarFilters;
  mapBounds: RadarMapBounds | null;
  areaSummary: string;
  committedAtIso: string;
};

export async function loadRadarCommittedState(userId: number): Promise<RadarCommittedState | null> {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RadarCommittedState;
    if (Number(parsed?.userId) !== userId) return null;
    if (!parsed?.filters || typeof parsed.filters !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRadarCommittedState(state: RadarCommittedState): Promise<void> {
  if (!Number.isFinite(state.userId) || state.userId <= 0) return;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        committedAtIso: state.committedAtIso || new Date().toISOString(),
      }),
    );
  } catch {
    // noop
  }
}
