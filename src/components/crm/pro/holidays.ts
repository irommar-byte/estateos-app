/** Święta państwowe i dni wolne w Polsce (stałe + ruchome od Wielkanocy). Klucz: YYYY-MM-DD. */
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cache = new Map<number, Map<string, string>>();

export function polishHolidays(y: number): Map<string, string> {
  const hit = cache.get(y);
  if (hit) return hit;
  const m = new Map<string, string>();
  const fixed: Array<[number, number, string]> = [
    [1, 1, 'Nowy Rok'], [1, 6, 'Trzech Króli'], [5, 1, 'Święto Pracy'], [5, 3, 'Święto Konstytucji 3 Maja'],
    [8, 15, 'Wniebowzięcie NMP'], [11, 1, 'Wszystkich Świętych'], [11, 11, 'Narodowe Święto Niepodległości'],
    [12, 25, 'Boże Narodzenie'], [12, 26, 'Drugi dzień Bożego Narodzenia'],
  ];
  for (const [mo, d, n] of fixed) m.set(key(new Date(y, mo - 1, d)), n);
  if (y >= 2025) m.set(key(new Date(y, 11, 24)), 'Wigilia');
  const e = easter(y);
  const add = (days: number, n: string) => { const d = new Date(e); d.setDate(d.getDate() + days); m.set(key(d), n); };
  add(0, 'Wielkanoc'); add(1, 'Poniedziałek Wielkanocny'); add(49, 'Zielone Świątki'); add(60, 'Boże Ciało');
  cache.set(y, m);
  return m;
}

export function holidayName(d: Date): string | null {
  return polishHolidays(d.getFullYear()).get(key(d)) || null;
}
export function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}
