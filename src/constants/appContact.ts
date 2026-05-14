/** Jeden adres obsługi użytkownika: pomoc, RODO, kontakt (App Store / weryfikacja). */
export const ESTATEOS_CONTACT_EMAIL = 'kontakt@estateos.pl';

export function mailtoEstateosSubject(subject: string): string {
  return `mailto:${ESTATEOS_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
