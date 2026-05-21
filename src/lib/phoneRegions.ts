/**
 * Kraje / kody wybierane przy rejestracji (parity z aplikacją mobilną).
 */

export type PhoneRegion = {
  iso2: string;
  name: string;
  namePl: string;
  dialCode: string;
  flag: string;
  localMaxDigits: number;
};

export const DEFAULT_PHONE_REGION_ISO = 'PL';

export const PHONE_REGIONS: PhoneRegion[] = [
  { iso2: 'PL', name: 'Poland', namePl: 'Polska', dialCode: '48', flag: '🇵🇱', localMaxDigits: 9 },
  { iso2: 'DE', name: 'Germany', namePl: 'Niemcy', dialCode: '49', flag: '🇩🇪', localMaxDigits: 11 },
  { iso2: 'GB', name: 'United Kingdom', namePl: 'Wielka Brytania', dialCode: '44', flag: '🇬🇧', localMaxDigits: 10 },
  { iso2: 'US', name: 'United States', namePl: 'USA', dialCode: '1', flag: '🇺🇸', localMaxDigits: 10 },
  { iso2: 'FR', name: 'France', namePl: 'Francja', dialCode: '33', flag: '🇫🇷', localMaxDigits: 9 },
  { iso2: 'IT', name: 'Italy', namePl: 'Włochy', dialCode: '39', flag: '🇮🇹', localMaxDigits: 10 },
  { iso2: 'ES', name: 'Spain', namePl: 'Hiszpania', dialCode: '34', flag: '🇪🇸', localMaxDigits: 9 },
  { iso2: 'NL', name: 'Netherlands', namePl: 'Holandia', dialCode: '31', flag: '🇳🇱', localMaxDigits: 9 },
  { iso2: 'BE', name: 'Belgium', namePl: 'Belgia', dialCode: '32', flag: '🇧🇪', localMaxDigits: 9 },
  { iso2: 'AT', name: 'Austria', namePl: 'Austria', dialCode: '43', flag: '🇦🇹', localMaxDigits: 10 },
  { iso2: 'CH', name: 'Switzerland', namePl: 'Szwajcaria', dialCode: '41', flag: '🇨🇭', localMaxDigits: 9 },
  { iso2: 'CZ', name: 'Czechia', namePl: 'Czechy', dialCode: '420', flag: '🇨🇿', localMaxDigits: 9 },
  { iso2: 'SK', name: 'Slovakia', namePl: 'Słowacja', dialCode: '421', flag: '🇸🇰', localMaxDigits: 9 },
  { iso2: 'UA', name: 'Ukraine', namePl: 'Ukraina', dialCode: '380', flag: '🇺🇦', localMaxDigits: 9 },
  { iso2: 'LT', name: 'Lithuania', namePl: 'Litwa', dialCode: '370', flag: '🇱🇹', localMaxDigits: 8 },
  { iso2: 'SE', name: 'Sweden', namePl: 'Szwecja', dialCode: '46', flag: '🇸🇪', localMaxDigits: 9 },
  { iso2: 'NO', name: 'Norway', namePl: 'Norwegia', dialCode: '47', flag: '🇳🇴', localMaxDigits: 8 },
  { iso2: 'IE', name: 'Ireland', namePl: 'Irlandia', dialCode: '353', flag: '🇮🇪', localMaxDigits: 9 },
];

export function getPhoneRegion(iso2: string): PhoneRegion {
  return PHONE_REGIONS.find((r) => r.iso2 === iso2) ?? PHONE_REGIONS[0];
}

export function formatLocalPhoneDisplay(iso2: string, digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (iso2 === 'PL' && d.length <= 9) {
    if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1 $2 $3').trim();
    if (d.length > 3) return d.replace(/(\d{3})(\d{0,3})/, '$1 $2').trim();
  }
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function buildE164FromRegion(region: PhoneRegion, localDigits: string): string {
  const local = localDigits.replace(/\D/g, '');
  if (!local) return '';
  return `+${region.dialCode}${local}`;
}
