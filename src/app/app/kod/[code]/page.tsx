import { redirect } from 'next/navigation';
import { redeemClientInviteCode } from '@/lib/crm/clientInviteCode';

export const dynamic = 'force-dynamic';

/**
 * Link z kodu QR. Z zainstalowaną aplikacją otwiera się aplikacja (universal link);
 * bez niej — przekierowanie prosto do panelu klienta w przeglądarce.
 */
export default async function InviteCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await redeemClientInviteCode(code);
  if (result) redirect(`/klient/${encodeURIComponent(result.portalToken)}`);
  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24 }}>Kod nieaktywny</h1>
      <p style={{ color: '#5B574F', lineHeight: 1.5 }}>Ten kod wygasł albo jest nieprawidłowy. Poproś swojego agenta o nowy kod do aplikacji EstateOS.</p>
    </main>
  );
}
