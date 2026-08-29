/** Smart Add jest zawsze włączony — import automatycznie uzupełnia parametry z opisu portalu. */
export const SMART_ADD_ALWAYS_ON = true;

export async function getIntelligenceSmartAddEnabled(_userId?: number): Promise<boolean> {
  return SMART_ADD_ALWAYS_ON;
}

/** Zachowane dla kompatybilności API — ustawienie użytkownika nie wyłącza już Smart Add. */
export async function setIntelligenceSmartAddEnabled(_userId: number, _enabled: boolean): Promise<boolean> {
  return SMART_ADD_ALWAYS_ON;
}
