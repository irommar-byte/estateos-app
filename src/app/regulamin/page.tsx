import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Regulamin | EstateOS',
  description: 'Regulamin korzystania z serwisu i aplikacji EstateOS — zasady publikacji, moderacji i kontaktu.',
  alternates: { canonical: 'https://estateos.pl/regulamin' },
};

const UPDATED = '14 maja 2026 r.';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Regulamin Serwisu EstateOS</h1>
      <p className="mb-8 text-sm text-zinc-500">Obowiązuje od: {UPDATED}</p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <p>
          Regulamin określa zasady korzystania z serwisu internetowego oraz aplikacji mobilnej <strong>EstateOS</strong>{' '}
          (dalej: „Serwis”). Korzystanie z Serwisu oznacza akceptację postanowień Regulaminu.
        </p>

        <h2 className="text-xl font-semibold">I. Postanowienia ogólne</h2>
        <p>
          Serwis umożliwia m.in. przeglądanie i publikowanie ogłoszeń nieruchomości, komunikację między użytkownikami
          oraz korzystanie z funkcji wspierających transakcje i współpracę. Administrator zastrzega prawo do rozwoju
          funkcji zgodnie z obowiązującym prawem.
        </p>

        <h2 className="text-xl font-semibold">II. Konto użytkownika i bezpieczeństwo</h2>
        <p>
          Użytkownik zobowiązany jest do podania prawdziwych danych w zakresie wymaganym przez Serwis oraz do
          zachowania poufności danych logowania. W przypadku podejrzenia nieautoryzowanego dostępu należy niezwłocznie
          poinformować administratora:{' '}
          <a className="text-emerald-700 underline" href="mailto:kontakt@estateos.pl">
            kontakt@estateos.pl
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold">III. Treści użytkowników (UGC) i moderacja</h2>
        <p>
          Zabronione jest publikowanie treści bezprawnych, wprowadzających w błąd, naruszających dobra osobiste lub
          prawa osób trzecich. Serwis może stosować środki moderacji (w tym usuwanie treści, blokowanie konta) w celu
          zapewnienia bezpieczeństwa i zgodności z prawem. Użytkownicy mogą zgłaszać naruszenia za pośrednictwem
          mechanizmów dostępnych w aplikacji.
        </p>

        <h2 className="text-xl font-semibold">IV. Odpowiedzialność i reklamacje</h2>
        <p>
          Serwis pełni rolę technologiczną i informacyjną; odpowiedzialność stron wobec siebie w zakresie transakcji
          określają odrębne umowy i przepisy prawa. Reklamacje dotyczące działania Serwisu można kierować na adres:{' '}
          <a className="text-emerald-700 underline" href="mailto:kontakt@estateos.pl">
            kontakt@estateos.pl
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold">V. Zmiany Regulaminu</h2>
        <p>
          Administrator może zmieniać Regulamin z przyczyn prawnych, organizacyjnych lub technicznych. O istotnych
          zmianach użytkownik zostanie poinformowany w sposób odpowiedni do Serwisu.
        </p>

        <p className="pt-4 text-sm text-zinc-500">
          Polityka prywatności:{' '}
          <Link className="text-emerald-700 underline" href="/polityka-prywatnosci">
            /polityka-prywatnosci
          </Link>
        </p>
      </section>
    </main>
  );
}
