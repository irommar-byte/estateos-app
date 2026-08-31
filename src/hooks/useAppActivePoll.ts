import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setActive(state === 'active');
    });
    return () => sub.remove();
  }, []);
  return active;
}

/** Runs callback on interval only while app is foregrounded. */
export function useAppActiveInterval(callback: () => void, ms: number, enabled = true) {
  const appActive = useAppIsActive();
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    if (!enabled || !appActive) return;
    const id = setInterval(() => cbRef.current(), ms);
    return () => clearInterval(id);
  }, [enabled, appActive, ms]);
}
