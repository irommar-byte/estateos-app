import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Usunięcie konta | EstateOS',
  description:
    'Jak trwale usunąć konto EstateOS i powiązane dane w aplikacji mobilnej lub przez kontakt z obsługą.',
  alternates: { canonical: 'https://estateos.pl/usun-konto' },
};

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Usunięcie konta EstateOS</h1>
      <p className="mb-8 text-sm text-zinc-500">Ostatnia aktualizacja: 15 czerwca 2026</p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <p>
          Jeśli masz konto w aplikacji <strong>EstateOS</strong>, możesz poprosić o trwałe usunięcie konta i
          powiązanych danych osobowych. Usunięcie jest nieodwracalne.
        </p>

        <h2 className="text-xl font-semibold">Sposób 1 — w aplikacji (zalecany)</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Otwórz aplikację EstateOS i zaloguj się.</li>
          <li>Przejdź do zakładki <strong>Profil</strong>.</li>
          <li>Wybierz <strong>Usuń konto</strong> (na dole ustawień konta).</li>
          <li>Potwierdź hasłem i zatwierdź trwałe usunięcie.</li>
        </ol>
        <p className="text-sm text-zinc-600">
          Jeśli logujesz się wyłącznie przez Passkey (Face ID) i nie masz hasła, najpierw ustaw hasło przez
          opcję „Nie pamiętam hasła” na ekranie logowania, a następnie powtórz usunięcie konta.
        </p>

        <h2 className="text-xl font-semibold">Sposób 2 — e-mail</h2>
        <p>
          Możesz też wysłać prośbę z adresu e-mail przypisanego do konta na:{' '}
          <a className="text-emerald-700 underline" href="mailto:privacy@estateos.pl?subject=Usunięcie%20konta%20EstateOS">
            privacy@estateos.pl
          </a>
          . W wiadomości podaj adres e-mail konta. Odpowiemy w rozsądnym terminie po weryfikacji tożsamości.
        </p>

        <h2 className="text-xl font-semibold">Co zostaje usunięte</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>dane profilu (imię, e-mail konta, avatar),</li>
          <li>preferencje radaru i ustawienia aplikacji powiązane z kontem,</li>
          <li>klucze Passkey przypisane do konta,</li>
          <li>dostęp do wiadomości i deal roomów powiązanych z kontem.</li>
        </ul>

        <h2 className="text-xl font-semibold">Co może zostać zachowane</h2>
        <p>
          Dane wymagane prawem (np. krótkie logi bezpieczeństwa, rozliczenia) lub anonimowe statystyki mogą być
          przechowywane przez okres wynikający z przepisów. Opublikowane ogłoszenia mogą zostać zarchiwizowane lub
          zdjęte zgodnie z regulaminem — szczegóły w{' '}
          <Link className="text-emerald-700 underline" href="/regulamin">
            regulaminie
          </Link>
          .
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
