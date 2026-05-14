import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  useColorScheme,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import * as Haptics from 'expo-haptics';
import { SITE_ORIGIN } from '../utils/offerShareUrls';
import { ESTATEOS_CONTACT_EMAIL, mailtoEstateosSubject } from '../constants/appContact';

/* Treść prawna / regulamin — liczne cudzysłowy w cytatach; escapowanie HTML psuje czytelność. */
/* eslint-disable react/no-unescaped-entities */

/**
 * Regulamin + Polityka Prywatności + zasady społecznościowe w jednym ekranie.
 *
 * Po co tyle treści w jednym miejscu?
 * ──────────────────────────────────
 * 1) Apple App Store Review Guideline 5.1.1 — aplikacja przetwarzająca dane
 *    osobowe MUSI mieć łatwo dostępną politykę prywatności.
 * 2) Apple Guideline 1.2 — aplikacja UGC MUSI publikować EULA z zerową
 *    tolerancją dla treści obraźliwych ORAZ opisać proces zgłaszania i
 *    blokowania.
 * 3) RODO (UE 2016/679) — wymagane informacje: kto przetwarza, jakie dane,
 *    na jakiej podstawie, jak długo, jakie prawa.
 *
 * Pełna, prawnie wiążąca wersja jest publikowana na stronie WWW (kanoniczny origin z konfiguracji aplikacji).
 * Linki są w sekcji "Pełny dokument prawny" na dole ekranu.
 */

export default function TermsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route.params as { initialScrollTo?: 'privacy' } | undefined;
  const scrollRef = useRef<ScrollView>(null);
  const privacyBlockY = useRef(0);
  const didAutoScrollPrivacy = useRef(false);

  const focusPrivacy = routeParams?.initialScrollTo === 'privacy';
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');
  const bgColor = isDark ? '#000000' : '#f5f5f7';
  const textColor = isDark ? '#ffffff' : '#1d1d1f';
  const subColor = isDark ? '#86868b' : '#86868b';
  const linkColor = isDark ? '#0A84FF' : '#0071e3';

  const openWWW = (url: string) => {
    Haptics.selectionAsync();
    Linking.openURL(url).catch(() => undefined);
  };

  const scrollToPrivacyBlock = (y: number) => {
    if (!focusPrivacy || didAutoScrollPrivacy.current) return;
    didAutoScrollPrivacy.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    });
  };

  const onPrivacyHeadingLayout = (e: LayoutChangeEvent) => {
    privacyBlockY.current = e.nativeEvent.layout.y;
    scrollToPrivacyBlock(e.nativeEvent.layout.y);
  };

  const headerTitle = focusPrivacy ? 'Polityka prywatności' : 'Regulamin EstateOS™';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.header}>
        <View style={styles.notch} />
        <Text style={[styles.headerTitle, { color: textColor }]}>{headerTitle}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            navigation.goBack();
          }}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={focusPrivacy ? 'Zamknij politykę prywatności' : 'Zamknij regulamin'}
        >
          <Text style={[styles.closeText, { color: linkColor }]}>Gotowe</Text>
        </Pressable>
      </BlurView>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: textColor }]}>Warunki, prywatność i zasady społecznościowe</Text>
        <Text style={[styles.date, { color: subColor }]}>Ostatnia aktualizacja: maj 2026</Text>

        <Text style={[styles.lead, { color: textColor }]}>
          Witamy w EstateOS™. Korzystając z aplikacji potwierdzasz, że zapoznałeś(-aś) się i
          akceptujesz poniższe zasady. Stworzyliśmy je tak, żeby chronić Twoją prywatność i
          dawać poczucie bezpieczeństwa w kontakcie z innymi użytkownikami.
        </Text>

        {/* ──────────────────────────────────────────────────────────────── */}
        <Text style={[styles.h1, { color: textColor }]}>I. Regulamin korzystania z aplikacji</Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Czym jest EstateOS™</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          EstateOS™ to platforma łącząca osoby poszukujące nieruchomości z właścicielami i
          agentami nieruchomości. Aplikacja umożliwia: publikowanie ofert sprzedaży lub wynajmu,
          przeglądanie ogłoszeń w okolicy (radar), prowadzenie rozmów w bezpiecznym kanale
          „Dealroom", a także zawieranie wstępnych ustaleń cenowych i terminów prezentacji.
          Nie pośredniczymy w transakcjach pieniężnych — finalna umowa zawierana jest pomiędzy
          stronami offline (notariusz, umowa cywilna).
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. Twoje konto</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Zakładając konto zobowiązujesz się do podania prawdziwych danych (imię, nazwisko,
          e-mail, numer telefonu) oraz do nieudostępniania konta osobom trzecim. Aplikacja
          weryfikuje numer telefonu kodem SMS i adres e-mail kodem cyfrowym. Możesz w każdej
          chwili usunąć konto z poziomu Profilu (sekcja „usuń konto" na dole ekranu) —
          operacja jest nieodwracalna i kasuje wszystkie Twoje dane, oferty oraz rozmowy.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. Publikowanie ofert</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Każda nowa oferta przechodzi wewnętrzną moderację — sprawdzamy zdjęcia, opis i cenę
          pod kątem zgodności z regulaminem oraz prawdziwości danych. Zastrzegamy sobie prawo
          do odrzucenia ogłoszeń, które są niezgodne ze standardami platformy, zawierają treści
          niedozwolone (patrz Sekcja II.3) lub naruszają prawa osób trzecich (np. cudze zdjęcia).
          Czas weryfikacji wynosi do 24 godzin roboczych.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>4. Płatności w aplikacji</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Płatne pakiety (np. „Pakiet Plus" — dodatkowy slot na 30 dni) są realizowane wyłącznie
          przez systemy płatnicze platform: Apple App Store na iOS i Google Play na Androidzie.
          Subskrypcjami i fakturami zarządzasz w ustawieniach swojego konta Apple ID lub Google.
          Zakupy są jednorazowe (consumable), nie odnawiają się automatycznie. Apple i Google
          dostarczają osobne potwierdzenia płatności na adres e-mail powiązany z kontem.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>5. Prowizja agentów</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Użytkownicy z rolą „Agent" mogą publikować oferty z deklarowaną prowizją (0% — 10%).
          Kwota prowizji jest jasno widoczna na karcie oferty kupującemu. Prowizja jest kwotą
          BRUTTO i nie podlega żadnym dodatkowym opłatom ani podatkom. Rozliczenie prowizji
          następuje bezpośrednio pomiędzy kupującym a agentem, poza aplikacją.
        </Text>

        {/* ──────────────────────────────────────────────────────────────── */}
        <Text style={[styles.h1, { color: textColor, marginTop: 32 }]}>
          II. Zasady społecznościowe i moderacja
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Zero tolerancji</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          EstateOS™ stosuje politykę zero tolerancji wobec treści obraźliwych, mowy nienawiści,
          spamu, oszustw, treści dla dorosłych oraz naruszeń praw autorskich. Łamanie tych zasad
          skutkuje usunięciem oferty lub konta — bez ostrzeżenia w przypadku rażących naruszeń.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. Zgłaszanie naruszeń</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Każdy zalogowany użytkownik może zgłosić ofertę lub rozmówcę z poziomu aplikacji:
          {'\n\n'}• <Text style={{ fontWeight: '700' }}>Oferta</Text> — przycisk „⋯" w prawym
          górnym rogu szczegółów oferty → „Zgłoś ofertę".
          {'\n'}• <Text style={{ fontWeight: '700' }}>Użytkownik</Text> — przycisk „⋯" w
          nagłówku rozmowy w Dealroom → „Zgłoś użytkownika".
          {'\n\n'}Każde zgłoszenie trafia do zespołu moderacji i jest weryfikowane w ciągu
          24 godzin. Jeśli zgłoszenie zostanie potwierdzone, podejmiemy odpowiednie kroki —
          od ukrycia oferty, przez czasową blokadę konta, po jego usunięcie.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. Blokowanie użytkowników</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Z tych samych miejsc („⋯") możesz zablokować konkretnego użytkownika. Po blokadzie:
          {'\n\n'}• jego oferty znikają z radaru i wyszukiwarki,
          {'\n'}• rozmowy z nim znikają z listy „Wiadomości",
          {'\n'}• nie otrzymujesz od niego nowych wiadomości.
          {'\n\n'}Blokada działa tylko po Twojej stronie — drugi użytkownik nie dostaje
          powiadomienia. Możesz w każdej chwili odblokować osobę w Profilu →
          „Zablokowani użytkownicy".
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>4. Treści niedozwolone</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          W ofertach, opisach, wiadomościach i recenzjach zabronione są: treści wulgarne,
          obraźliwe, dyskryminacyjne (płeć, narodowość, religia, orientacja), zawierające
          groźby, propagujące przemoc lub działania nielegalne, reklamujące alkohol, tytoń,
          hazard, kryptowaluty „pump-and-dump" oraz wszelkie próby wyłudzenia płatności poza
          aplikacją (oszustwa typu „przedpłata", phishing, fałszywe linki do bramek).
        </Text>

        {/* ──────────────────────────────────────────────────────────────── */}
        <View onLayout={onPrivacyHeadingLayout}>
          <Text style={[styles.h1, { color: textColor, marginTop: 32 }]}>III. Polityka prywatności</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Kto przetwarza dane</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Administratorem Twoich danych osobowych jest EstateOS™ (właściciel marki) z siedzibą
          w Polsce. Kontakt w sprawach prywatności i danych osobowych:{' '}
          <Text
            onPress={() => openWWW(mailtoEstateosSubject('EstateOS — prywatność / RODO'))}
            style={{ color: linkColor, fontWeight: '600' }}
          >
            {ESTATEOS_CONTACT_EMAIL}
          </Text>
          .
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. Jakie dane zbieramy</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          • <Text style={{ fontWeight: '700' }}>Dane konta:</Text> imię, nazwisko, e-mail,
          numer telefonu, opcjonalnie awatar i nazwa firmy (dla agentów).
          {'\n'}• <Text style={{ fontWeight: '700' }}>Treści, które publikujesz:</Text> oferty,
          zdjęcia nieruchomości, wiadomości w Dealroom.
          {'\n'}• <Text style={{ fontWeight: '700' }}>Lokalizacja:</Text> tylko podczas
          korzystania z aplikacji (foreground) — używana do pokazania ofert w pobliżu i do
          ustawienia radaru.
          {'\n'}• <Text style={{ fontWeight: '700' }}>Dane techniczne:</Text> model urządzenia,
          wersja systemu, identyfikator instalacji (push token) — bez śledzenia między aplikacjami.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. Po co</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Dane są przetwarzane wyłącznie w celu świadczenia usługi: pokazywania ofert,
          dopasowywania radaru, prowadzenia rozmów, weryfikacji konta i — w razie potrzeby —
          obsługi zgłoszeń moderacyjnych. NIE używamy Twoich danych do profilowania
          reklamowego ani nie przekazujemy ich firmom trzecim w celach marketingowych.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>4. Brak śledzenia</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Aplikacja NIE śledzi Cię między innymi aplikacjami i stronami internetowymi
          (Apple AppTrackingTransparency). Nie korzystamy z Facebook SDK, Google Analytics,
          AdMob, ani podobnych narzędzi reklamowych.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>5. Jak długo przechowujemy</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Dane konta i opublikowane oferty przechowujemy tak długo, jak istnieje Twoje konto.
          Po usunięciu konta (Profile → „usuń konto") wszystkie dane są permanentnie kasowane
          w ciągu maksymalnie 30 dni, z wyjątkiem obowiązkowych logów księgowych dotyczących
          zakupów (Apple/Google) przechowywanych zgodnie z polskim prawem podatkowym (5 lat).
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>6. Twoje prawa (RODO)</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Masz prawo do: dostępu do swoich danych, sprostowania, usunięcia („prawo do bycia
          zapomnianym"), ograniczenia przetwarzania, przeniesienia danych, sprzeciwu oraz
          wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO). Wnioski w tych
          sprawach wysyłaj na{' '}
          <Text
            onPress={() => openWWW(mailtoEstateosSubject('EstateOS — wniosek RODO'))}
            style={{ color: linkColor, fontWeight: '600' }}
          >
            {ESTATEOS_CONTACT_EMAIL}
          </Text>
          .
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>7. Uprawnienia systemowe</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          • <Text style={{ fontWeight: '700' }}>Aparat i biblioteka zdjęć</Text> — tylko gdy
          dodajesz zdjęcia do swojej oferty.
          {'\n'}• <Text style={{ fontWeight: '700' }}>Lokalizacja</Text> — tylko podczas
          używania aplikacji (radar i odległości do prezentacji), nie pracujemy w tle.
          {'\n'}• <Text style={{ fontWeight: '700' }}>Powiadomienia</Text> — funkcjonalne
          alerty Radaru (nowe dopasowania), wiadomości w Dealroom, statusy ofert. Nigdy nie
          wysyłamy pushy reklamowych.
          {'\n'}• <Text style={{ fontWeight: '700' }}>Face ID / Touch ID</Text> — opcjonalne
          logowanie bez hasła (Passkey). Dane biometryczne nigdy nie opuszczają urządzenia.
          {'\n'}• <Text style={{ fontWeight: '700' }}>Kalendarz</Text> — opcjonalnie, gdy
          zapisujemy termin potwierdzonej prezentacji.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>8. Bezpieczeństwo</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Komunikacja z serwerem odbywa się wyłącznie przez HTTPS (App Transport Security
          włączone). Hasła są przechowywane w postaci hashy bcrypt. Lokalne tokeny logowania
          są zaszyfrowane w Keychain (iOS) / Keystore (Android).
        </Text>

        {/* ──────────────────────────────────────────────────────────────── */}
        <Text style={[styles.h1, { color: textColor, marginTop: 32 }]}>IV. Kontakt i pełna treść</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Pomoc techniczna i sprawy ogólne:{' '}
          <Text
            onPress={() => openWWW(mailtoEstateosSubject('EstateOS — pomoc'))}
            style={{ color: linkColor, fontWeight: '600' }}
          >
            {ESTATEOS_CONTACT_EMAIL}
          </Text>
          . Pełne, prawnie wiążące wersje dokumentów WWW (gdy są opublikowane na serwerze):
        </Text>
        <Pressable
          onPress={() => openWWW(`${SITE_ORIGIN}/regulamin`)}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: linkColor }]}>
            {`${SITE_ORIGIN}/regulamin`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => openWWW(`${SITE_ORIGIN}/polityka-prywatnosci`)}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: linkColor }]}>
            {`${SITE_ORIGIN}/polityka-prywatnosci`}
          </Text>
        </Pressable>

        <Text style={[styles.footer, { color: subColor }]}>
          © 2026 EstateOS™. Wszystkie prawa zastrzeżone.
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 15 : 20,
    paddingBottom: 15,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    zIndex: 10,
  },
  notch: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', marginBottom: 15 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { position: 'absolute', right: 20, top: Platform.OS === 'ios' ? 32 : 37 },
  closeText: { fontSize: 17, fontWeight: '600' },
  content: { padding: 25, paddingTop: 30 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 5, letterSpacing: -0.5 },
  date: { fontSize: 13, fontWeight: '500', marginBottom: 22 },
  lead: { fontSize: 16, lineHeight: 24, marginBottom: 24, fontWeight: '500' },
  h1: { fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 6, letterSpacing: -0.3 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  paragraph: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  linkRow: { paddingVertical: 8 },
  linkText: { fontSize: 15, fontWeight: '600' },
  footer: { fontSize: 12, marginTop: 30, textAlign: 'center' },
});
