import { redirect } from 'next/navigation';

/**
 * Jeden CRM na WWW: dawny „Desk” (/crm/*) prowadzi do panelu CRM w Moim koncie,
 * który działa na tych samych danych co CRM w aplikacji.
 */
export default function CrmDeskLayout() {
  redirect('/moje-konto/crm');
}
