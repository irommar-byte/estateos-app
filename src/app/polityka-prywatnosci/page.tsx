import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Polityka prywatności | EstateOS',
  description:
    'Polityka prywatności serwisu EstateOS — przetwarzanie danych osobowych, kontakt i prawa użytkownika.',
  alternates: { canonical: 'https://estateos.pl/polityka-prywatnosci' },
};

const UPDATED = '14 maja 2026 r.';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Polityka prywatności</h1>
      <p className="mb-8 text-sm text-zinc-500">Obowiązuje od: {UPDATED}</p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <p>
          Niniejsza polityka prywatności określa zasady przetwarzania danych osobowych użytkowników korzystających z
          serwisu internetowego i aplikacji mobilnej <strong>EstateOS</strong> (dalej: „Serwis”).
        </p>

        <h2 className="text-xl font-semibold">Administrator danych</h2>
        <p>
          Administratorem danych osobowych jest podmiot prowadzący Serwis EstateOS. W sprawach dotyczących
          prywatności i ochrony danych prosimy o kontakt:{' '}
          <a className="text-emerald-700 underline" href="mailto:kontakt@estateos.pl">
            kontakt@estateos.pl
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold">Zakres i cele przetwarzania</h2>
        <p>
          Przetwarzamy dane niezbędne do świadczenia usług Serwisu, w tym: utworzenia i obsługi konta, publikacji
          ogłoszeń, komunikacji związanej z kontem, obsługi zgłoszeń i wiadomości, bezpieczeństwa (w tym logowania i
          uwierzytelniania), rozwoju funkcji oraz wypełnienia obowiązków prawnych.
        </p>

        <h2 className="text-xl font-semibold">Podstawy prawne</h2>
        <p>
          Podstawą przetwarzania może być w szczególności: wykonanie umowy lub podjęcie działań przed jej zawarciem
          (art. 6 ust. 1 lit. b RODO), prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO), zgoda
          użytkownika (art. 6 ust. 1 lit. a RODO) oraz obowiązek prawny (art. 6 ust. 1 lit. c RODO).
        </p>

        <h2 className="text-xl font-semibold">Okres przechowywania</h2>
        <p>
          Dane przechowujemy przez okres niezbędny do realizacji celów, a następnie przez czas wymagany przepisami
          prawa lub do przedawnienia roszczeń — w zależności od tego, który okres jest dłuższy.
        </p>

        <h2 className="text-xl font-semibold">Prawa użytkownika</h2>
        <p>
          Przysługuje Pani/Panu m.in. prawo dostępu do danych, ich sprostowania, usunięcia lub ograniczenia
          przetwarzania, sprzeciwu wobec przetwarzania, przenoszenia danych oraz cofnięcia zgody w zakresie, w jakim
          przetwarzanie odbywa się na podstawie zgody.
        </p>

        <h2 className="text-xl font-semibold">Pliki cookies i technologie pokrewne</h2>
        <p>
          Serwis może wykorzystywać pliki cookies i podobne technologie w celach funkcjonalnych, bezpieczeństwa oraz
          analityki — w zakresie wymaganym prawem i z uwzględnieniem ustawień przeglądarki.
        </p>

        <h2 className="text-xl font-semibold">Postanowienia końcowe</h2>
        <p>
          Polityka może być aktualizowana. O istotnych zmianach poinformujemy w sposób odpowiedni do charakteru Serwisu
          (np. komunikat w aplikacji lub na stronie).
        </p>

        <p className="pt-4 text-sm text-zinc-500">
          Regulamin Serwisu:{' '}
          <Link className="text-emerald-700 underline" href="/regulamin">
            /regulamin
          </Link>
        </p>
      </section>
    </main>
  );
}
