import { redirect } from 'next/navigation';

/** Dawny „Desk” — jeden CRM jest w /moje-konto/crm. */
export default function Page() {
  redirect('/moje-konto/crm');
}
