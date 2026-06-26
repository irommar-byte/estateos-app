'use client';

import { useCallback, useMemo, useState } from 'react';
import { Smartphone } from 'lucide-react';
import {
  buildOfferAndroidIntentUrl,
  buildOfferAppSchemeUrl,
  detectMobileAppContext,
  ESTATEOS_APP_STORE_URL,
  ESTATEOS_PLAY_STORE_URL,
} from '@/lib/estateosAppLinks';

type Props = {
  offerId: number;
  canonicalUrl: string;
};

export default function OfferShareOpenInAppButton({ offerId, canonicalUrl }: Props) {
  const [hint, setHint] = useState('');
  const ctx = useMemo(() => detectMobileAppContext(), []);

  const handleClick = useCallback(() => {
    if (ctx.isAndroid) {
      window.location.href = buildOfferAndroidIntentUrl(offerId, canonicalUrl);
      return;
    }
    if (ctx.isIOS) {
      setHint('Otwieranie aplikacji…');
      window.location.href = buildOfferAppSchemeUrl(offerId);
      window.setTimeout(() => {
        setHint('Brak aplikacji? Pobierz ją z App Store — oferta otworzy się automatycznie.');
      }, 2000);
      return;
    }
    window.open(ESTATEOS_APP_STORE_URL, '_blank', 'noopener,noreferrer');
  }, [canonicalUrl, ctx.isAndroid, ctx.isIOS, offerId]);

  const label = ctx.isIOS || ctx.isAndroid ? 'Otwórz w aplikacji EstateOS™' : 'Pobierz aplikację EstateOS™';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#b8922e]/35 bg-gradient-to-r from-[#faf8f2] to-white px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#141416] shadow-[0_8px_24px_rgba(184,146,46,0.12)] transition hover:border-[#b8922e]/55 dark:from-[#141416] dark:to-[#101014] dark:text-white"
      >
        <Smartphone size={16} className="text-[#b8922e]" />
        {label}
      </button>
      {hint ? (
        <p className="text-center text-[11px] leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">{hint}</p>
      ) : (
        <p className="text-center text-[10px] leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
          {ctx.isIOS
            ? 'Zainstaluj z App Store — po pierwszym uruchomieniu ta oferta otworzy się sama.'
            : ctx.isAndroid
              ? 'Dostępna w Google Play lub jako wersja beta.'
              : 'Radar, Deal Room i mapa 3D — w aplikacji mobilnej.'}
        </p>
      )}
      {!ctx.isIOS && !ctx.isAndroid ? (
        <p className="text-center text-[10px] text-[#8e8e93]">
          <a href={ESTATEOS_PLAY_STORE_URL} className="underline-offset-2 hover:underline">
            Google Play
          </a>
          {' · '}
          <a href={ESTATEOS_APP_STORE_URL} className="underline-offset-2 hover:underline">
            App Store
          </a>
        </p>
      ) : null}
    </div>
  );
}
