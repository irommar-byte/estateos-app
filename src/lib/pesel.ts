export type PeselData = {
  pesel: string;
  birthDate: string;
  gender: 'K' | 'M';
};

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function parsePesel(raw: string): PeselData | null {
  const pesel = raw.replace(/\D/g, '');
  if (pesel.length !== 11) return null;

  const digits = pesel.split('').map((d) => Number(d));
  if (digits.some((d) => Number.isNaN(d))) return null;

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  const checksum = (10 - (sum % 10)) % 10;
  if (checksum !== digits[10]) return null;

  const yy = Number(pesel.slice(0, 2));
  const mmRaw = Number(pesel.slice(2, 4));
  const dd = Number(pesel.slice(4, 6));

  let year = 1900 + yy;
  let month = mmRaw;
  if (mmRaw >= 81 && mmRaw <= 92) {
    year = 1800 + yy;
    month = mmRaw - 80;
  } else if (mmRaw >= 1 && mmRaw <= 12) {
    year = 1900 + yy;
  } else if (mmRaw >= 21 && mmRaw <= 32) {
    year = 2000 + yy;
    month = mmRaw - 20;
  } else if (mmRaw >= 41 && mmRaw <= 52) {
    year = 2100 + yy;
    month = mmRaw - 40;
  } else if (mmRaw >= 61 && mmRaw <= 72) {
    year = 2200 + yy;
    month = mmRaw - 60;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, dd));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }

  const gender = digits[9] % 2 === 0 ? 'K' : 'M';
  return { pesel, birthDate: toIsoDate(year, month, dd), gender };
}

export function peselAgeYears(birthDate: string, now = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return 0;
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function polishAgePhrase(age: number): string {
  const n = Math.abs(age) % 100;
  const last = n % 10;
  if (n === 1) return `${age} rok`;
  if (n >= 12 && n <= 14) return `${age} lat`;
  if (last >= 2 && last <= 4) return `${age} lata`;
  return `${age} lat`;
}

/** np. "Mężczyzna, 49 lat" — albo null, gdy PESEL nie przechodzi walidacji. */
export function formatPeselDecode(raw: string, now = new Date()): string | null {
  const data = parsePesel(raw);
  if (!data) return null;
  const gender = data.gender === 'M' ? 'Mężczyzna' : 'Kobieta';
  return `${gender}, ${polishAgePhrase(peselAgeYears(data.birthDate, now))}`;
}
