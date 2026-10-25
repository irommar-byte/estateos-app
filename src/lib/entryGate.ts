/**
 * Tymczasowa „otoczka” wejścia do aplikacji:
 *  • agent — zwykłe logowanie, bez rejestracji,
 *  • klient — tylko na zaproszenie (QR albo 6-cyfrowy kod od agenta).
 * Wyłączenie: ustaw na false — aplikacja wraca do dotychczasowego zachowania.
 */
export const INVITE_ONLY_ENTRY = false;
