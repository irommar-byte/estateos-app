#!/usr/bin/env python3
"""Generate Localizable.xcstrings and InfoPlist.xcstrings for ParagonOS."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "ParagonOS" / "Resources"

# Polish source -> English, Ukrainian
STRINGS = {
    "Kaucje": ("Deposits", "Застави"),
    "Paragony": ("Receipts", "Чеки"),
    "Karty": ("Cards", "Картки"),
    "Historia": ("History", "Історія"),
    "Rodzina": ("Family", "Родина"),
    "Ustawienia": ("Settings", "Налаштування"),
    "Skanuj": ("Scan", "Сканувати"),
    "Skanuj kaucję": ("Scan deposit", "Сканувати заставу"),
    "Skanuj paragon": ("Scan receipt", "Сканувати чек"),
    "Skanuj kartę": ("Scan card", "Сканувати картку"),
    "Skanuj kartę lojalnościową": ("Scan loyalty card", "Сканувати картку лояльності"),
    "Skanuj kwitek": ("Scan voucher", "Сканувати квиток"),
    "Po butelkomacie": ("After the reverse vending machine", "Після автомата"),
    "Wpisz ręcznie": ("Enter manually", "Ввести вручну"),
    "Wybierz sklep": ("Choose a store", "Обрати магазин"),
    "Dodaj kaucję": ("Add deposit", "Додати заставу"),
    "Dodaj kartę": ("Add card", "Додати картку"),
    "Co skanujesz?": ("What are you scanning?", "Що скануєш?"),
    "Kaucja z butelkomatu": ("Reverse-vending voucher", "Квиток з автомата"),
    "Paragon lub faktura": ("Receipt or invoice", "Чек або рахунок"),
    "Karta lojalnościowa": ("Loyalty card", "Картка лояльності"),
    "Anuluj": ("Cancel", "Скасувати"),
    "Nie teraz": ("Not now", "Не зараз"),
    "Może kawa? Nic nie musisz.": ("A coffee? Only if you want.", "Кава? Тільки якщо хочеш."),
    "Tylko jeśli masz ochotę. Trzy łyki dla twórcy.": ("Only if you feel like it. Three sips for the maker.", "Лише якщо хочеш. Три ковтки для творця."),
    "Dziękuję.": ("Thank you.", "Дякую."),
    "Dziękuję że jesteś.": ("Thank you for being here.", "Дякую, що ти є."),
    "Innym razem.": ("Another time.", "Іншим разом."),
    "Nie udało się otworzyć płatności Apple.": ("Couldn’t open Apple’s payment sheet.", "Не вдалося відкрити оплату Apple."),
    "Płatność czeka na potwierdzenie.": ("The payment is waiting for approval.", "Оплата чекає підтвердження."),
    "Mała": ("Small", "Мала"),
    "Średnia": ("Medium", "Середня"),
    "Duża": ("Large", "Велика"),
    "Kawa": ("Coffee", "Кава"),
    "Napiwek idzie przez zakupy w aplikacji. Nic nie musisz.": ("The tip goes through in-app purchase. You don’t have to.", "Чайові йдуть через покупку в програмі. Нічого не мусиш."),
    "5, 10 albo 20 zł. Arkusz Apple, bez presji.": ("5, 10 or 20 PLN. Apple’s sheet, no pressure.", "5, 10 або 20 злотих. Аркуш Apple, без тиску."),
    "Podoba Ci się ParagonOS?": ("Do you like ParagonOS?", "Подобається ParagonOS?"),
    "Co poprawić?": ("What should we improve?", "Що покращити?"),
    "Opcjonalnie, zostaje na tym iPhonie": ("Optional, stays on this iPhone", "Необов’язково, лишається на цьому iPhone"),
    "Wyślij": ("Send", "Надіслати"),
    "Oceń w App Store": ("Rate on the App Store", "Оцінити в App Store"),
    "Ocena": ("Rating", "Оцінка"),
    "Język": ("Language", "Мова"),
    "Język iPhone’a": ("iPhone language", "Мова iPhone"),
    "Konto": ("Account", "Обліковий запис"),
    "Twoje imię": ("Your name", "Твоє ім’я"),
    "Skanowanie": ("Scanning", "Сканування"),
    "Po plusie od razu włącz aparat": ("The plus button opens the camera immediately", "Плюс одразу вмикає камеру"),
    "Prywatność": ("Privacy", "Приватність"),
    "Ochrona": ("Protection", "Захист"),
    "Kasa": ("Checkout", "Каса"),
    "Maksymalna jasność przy kodzie": ("Maximum brightness for the code", "Максимальна яскравість для коду"),
    "Sklepy": ("Stores", "Магазини"),
    "Według sklepów": ("By store", "За магазинами"),
    "Inne": ("Other", "Інші"),
    "Wszystkie paragony": ("All receipts", "Усі чеки"),
    "Suma": ("Total", "Сума"),
    "NIP": ("Tax ID", "ІПН"),
    "Ten miesiąc": ("This month", "Цей місяць"),
    "Wszystkie": ("All", "Усі"),
    "Brak paragonów": ("No receipts", "Немає чеків"),
    "Brak historii kaucji": ("No deposit history", "Немає історії застав"),
    "Brak historii wydatków": ("No spending history", "Немає історії витрат"),
    "Przy kasie": ("At checkout", "На касі"),
    "Pokaż przy kasie": ("Show at checkout", "Показати на касі"),
    "Skanuj pierwszy kwitek": ("Scan the first voucher", "Скануй перший квиток"),
    "Dodaj kartę, żeby pokazać kod przy kasie.": ("Add a card to show the code at checkout.", "Додай картку, щоб показати код на касі."),
    "Kaucja i kasa": ("Deposit and checkout", "Застава і каса"),
    "Kaucja": ("Deposit", "Застава"),
    "Odzyskane": ("Recovered", "Повернено"),
    "Utracone": ("Lost", "Втрачено"),
    "Wykorzystane": ("Redeemed", "Використано"),
    "Przeterminowane": ("Expired", "Прострочено"),
    "Przywróć": ("Restore", "Відновити"),
    "Usuń": ("Delete", "Видалити"),
    "Zakres": ("Scope", "Охоплення"),
    "Okres": ("Period", "Період"),
    "Rok": ("Year", "Рік"),
    "Miesiąc": ("Month", "Місяць"),
    "Dokumenty": ("Documents", "Документи"),
    "Aktywny": ("Active", "Активний"),
    "Wykorzystany": ("Redeemed", "Використаний"),
    "Przeterminowany": ("Expired", "Прострочений"),
    "przeterminowany": ("expired", "прострочений"),
    "wygasa dzisiaj": ("expires today", "закінчується сьогодні"),
    "wygasa jutro": ("expires tomorrow", "закінчується завтра"),
    "Bez terminu": ("No expiry", "Без терміну"),
    "Brak kodu": ("No code", "Немає коду"),
    "Synchronizuj teraz": ("Sync now", "Синхронізувати зараз"),
    "Twoje urządzenia": ("Your devices", "Твої пристрої"),
    "Synchronizacja": ("Sync", "Синхронізація"),
    "Ostatnio": ("Last time", "Востаннє"),
    "Nie ma już tego kwitka": ("This voucher is gone", "Цього квитка вже немає"),
    "Nie ma już tego paragonu": ("This receipt is gone", "Цього чека вже немає"),
    "Nie ma już tego sklepu": ("This store is gone", "Цього магазину вже немає"),
    "Otwiera kartę": ("Opens the card", "Відкриває картку"),
    "Zwiń stos": ("Collapse stack", "Згорнути стос"),
    "Rozsuń karty": ("Fan the cards", "Розгорнути картки"),
    "Sklep, NIP albo kwota": ("Store, tax ID or amount", "Магазин, ІПН або сума"),
}


def unit(value: str, state="translated"):
    return {"stringUnit": {"state": state, "value": value}}


def entry(en: str, uk: str, source: str):
    return {
        "localizations": {
            "en": unit(en),
            "pl": unit(source),
            "uk": unit(uk),
        }
    }


def write_catalog(path: Path, strings: dict, source_locale="pl"):
    data = {
        "sourceLanguage": source_locale,
        "strings": {key: entry(en, uk, key) for key, (en, uk) in strings.items()},
        "version": "1.0",
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


INFO = {
    "NSFaceIDUsageDescription": (
        "ParagonOS™ uses Face ID to protect deposits, receipts and cards on this iPhone.",
        "ParagonOS™ використовує Face ID, щоб захистити застави, чеки та картки на цьому iPhone.",
        "ParagonOS™ używa Face ID, żeby chronić kaucje, paragony i karty na tym iPhonie.",
    ),
    "NSCameraUsageDescription": (
        "ParagonOS™ uses the camera to scan a reverse-vending voucher, a receipt or a loyalty card.",
        "ParagonOS™ використовує камеру, щоб сканувати квиток з автомата, чек або картку лояльності.",
        "ParagonOS™ używa kamery, żeby zeskanować kwitek z butelkomatu, paragon albo kartę lojalnościową.",
    ),
    "NSPhotoLibraryUsageDescription": (
        "ParagonOS™ reads a voucher, receipt or card photo from the library when the live scanner is unavailable.",
        "ParagonOS™ зчитує фото квитка, чека або картки з бібліотеки, коли сканер недоступний.",
        "ParagonOS™ wczytuje zdjęcie kwitka, paragonu albo karty z galerii, gdy skaner na żywo jest niedostępny.",
    ),
    "NSUserNotificationsUsageDescription": (
        "ParagonOS™ reminds you about deposit expiry, warranties and return deadlines.",
        "ParagonOS™ нагадує про кінець застави, гарантії та термін повернення.",
        "ParagonOS™ przypomina o końcu ważności kaucji, gwarancji i terminie zwrotu.",
    ),
    "NSLocationWhenInUseUsageDescription": (
        "ParagonOS™ uses location to show nearby reverse-vending machines. Location stays on this iPhone.",
        "ParagonOS™ використовує розташування, щоб показати автомати поруч. Місце лишається на цьому iPhone.",
        "ParagonOS™ używa lokalizacji, żeby pokazać butelkomaty i sklepy z kaucją w pobliżu. Położenie zostaje na tym iPhonie.",
    ),
}


def write_infoplist(path: Path):
    strings = {}
    for key, (en, uk, pl) in INFO.items():
        strings[key] = {
            "localizations": {
                "en": unit(en),
                "pl": unit(pl),
                "uk": unit(uk),
            }
        }
    data = {"sourceLanguage": "pl", "strings": strings, "version": "1.0"}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    write_catalog(ROOT / "Localizable.xcstrings", STRINGS)
    write_infoplist(ROOT / "InfoPlist.xcstrings")
    widgets = ROOT.parent.parent / "ParagonOSWidgets"
    if widgets.exists():
        write_catalog(widgets / "Localizable.xcstrings", STRINGS)
    print(f"wrote {len(STRINGS)} strings")
