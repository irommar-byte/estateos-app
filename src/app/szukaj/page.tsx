import { redirect } from 'next/navigation';

/** Jeden formularz wyszukiwania w całym ekosystemie — stary /szukaj prowadzi do /szukam. */
export default function SzukajRedirect() {
  redirect('/szukam');
}
