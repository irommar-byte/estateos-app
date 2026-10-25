import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { redeemInviteCode, redeemInviteLinkKey, requestIp, type InviteRedeemResult } from '@/lib/crm/clientInviteCode';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Panel klienta · EstateOS',
  description: 'Twój prywatny panel od agenta nieruchomości.',
  robots: { index: false, follow: false },
};

const COPY: Record<Exclude<InviteRedeemResult, { ok: true }>['reason'], { title: string; tip: string }> = {
  invalid: { title: 'Nie rozpoznajemy tego kodu', tip: 'Sprawdź, czy link albo cyfry są skopiowane w całości.' },
  expired: { title: 'Kod wygasł', tip: 'Sam link z wiadomości od agenta nie wygasa — spróbuj otworzyć właśnie jego.' },
  revoked: { title: 'Ten dostęp został zmieniony', tip: 'Agent wygenerował nowy link albo kod. Poproś go o aktualny.' },
  rate_limited: { title: 'Za dużo prób', tip: 'To zabezpieczenie Twojego panelu. Odczekaj chwilę albo otwórz link z wiadomości.' },
  busy: { title: 'Chwilowa przerwa', tip: 'Link z wiadomości od agenta działa normalnie.' },
};

/**
 * Link z QR / wiadomości od agenta. Z aplikacją EstateOS na iPhonie otwiera się aplikacja
 * (universal link). Na każdym innym urządzeniu — Android, komputer, iPhone bez aplikacji —
 * od razu panel w przeglądarce; tam karta podpowie, jak dodać go na ekran telefonu.
 */
export default async function InviteCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query, h] = await Promise.all([params, searchParams, headers()]);
  const ip = requestIp(h);
  const k = typeof query.k === 'string' ? query.k : '';
  const segment = decodeURIComponent(String(code || ''));
  const result = k
    ? await redeemInviteLinkKey(k, ip)
    : /^\d{6}$/.test(segment)
      ? await redeemInviteCode(segment, ip)
      : await redeemInviteLinkKey(segment, ip);

  if (result.ok) redirect(`/klient/${encodeURIComponent(result.portalToken)}?witaj=1`);

  const copy = COPY[result.reason];
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F6F3EE] px-4 py-16 text-[#15171A]">
      <div className="w-full max-w-[440px] rounded-[28px] border border-[#ECE6DC] bg-white p-7 shadow-[0_24px_60px_rgba(21,23,26,0.08)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="h-6 w-auto invert" />
        <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A5F33]">Panel klienta</p>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight">{copy.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#45423C]">{result.error}</p>
        <div className="mt-6 rounded-2xl bg-[#F6F3EE] p-4 text-[13px] leading-relaxed text-[#5B574F]">
          <p className="font-bold text-[#15171A]">Co teraz?</p>
          <p className="mt-1">{copy.tip}</p>
          <p className="mt-2">Twój agent może w każdej chwili wysłać nowy dostęp — jednym kliknięciem w swojej aplikacji.</p>
        </div>
        <Link href="/" className="mt-6 inline-block text-[14px] font-semibold text-[#0E4D3F] underline underline-offset-4">
          Przejdź na estateos.pl
        </Link>
      </div>
    </main>
  );
}
