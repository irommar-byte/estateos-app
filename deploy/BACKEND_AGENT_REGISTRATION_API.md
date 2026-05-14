# Backend: rejestracja roli `AGENT` (biura nieruchomości)

> **Status frontend:** ✅ gotowe, działa na produkcji. Mobilna apka wysyła
> już dane do `POST /api/register` z nowym polem `companyName` dla roli
> `AGENT`.
>
> **Status backend:** ⏳ DO ZROBIENIA — opisane poniżej.

---

## Tło biznesowe

W aplikacji mobilnej (`AuthScreen`) odblokowaliśmy drugą rolę przy
rejestracji obok `PRIVATE`. Wcześniej miał tu być `PARTNER` (do współpracy
z EstateOS™ jako podmiot biznesowy), ale **partner zostaje wyłącznie na
WWW i wymaga dedykowanego onboardingu** — w mobilce wprowadzamy
**`AGENT`**, czyli zwykłego pośrednika nieruchomości reprezentującego
biuro/agencję.

**WAŻNE:** `AGENT` ≠ `PARTNER`. To dwa różne typy kont z różnymi
uprawnieniami. Nie mieszać.

---

## Co aplikacja wysyła

```http
POST https://estateos.pl/api/register
Content-Type: application/json

{
  "email": "anna.kowalska@nieruchomosci-warszawa.pl",
  "password": "********",
  "name": "Anna Kowalska",
  "phone": "+48 600 700 800",
  "role": "AGENT",
  "companyName": "Nieruchomości Warszawa Sp. z o.o."
}
```

Dla roli `PRIVATE` payload pozostaje bez zmian — pole `companyName`
**nie jest wysyłane**:

```http
POST https://estateos.pl/api/register
Content-Type: application/json

{
  "email": "jan@example.com",
  "password": "********",
  "name": "Jan Nowak",
  "phone": "+48 600 000 000",
  "role": "PRIVATE"
}
```

---

## Wymagane zmiany w backendzie

### 1. Walidacja `role`

Dziś endpoint prawdopodobnie akceptuje dowolny string w `role`. Zaostrz
walidację — pole MUSI być jednym z:

```
'PRIVATE' | 'AGENT'
```

Dla każdej innej wartości (np. `PARTNER`, `ADMIN`, `AGENCY`) zwróć
`400 Bad Request` z `{ error: 'INVALID_ROLE' }`. Konta z rolą inną niż
te dwie zakłada się tylko przez panel administratora.

### 2. Walidacja `companyName`

| `role`     | `companyName`                                    | Zachowanie |
|------------|---------------------------------------------------|------------|
| `PRIVATE`  | brak / pusty / null                               | OK         |
| `PRIVATE`  | wypełnione                                        | Zignoruj (nie zapisuj) |
| `AGENT`    | brak / pusty / krótszy niż 2 znaki                | `400 { error: 'COMPANY_NAME_REQUIRED' }` |
| `AGENT`    | string 2..80 znaków                               | Zapisz w DB |

Trim white-space, max 80 znaków (frontend egzekwuje `maxLength={80}`,
ale backend musi mieć własną asercję).

### 3. Migracja bazy danych

Tabela `users` (Prisma / SQL — dostosuj):

```sql
ALTER TABLE users
ADD COLUMN company_name VARCHAR(80) NULL;
```

Lub w Prismie:

```prisma
model User {
  // ...
  role        UserRole  @default(PRIVATE)
  companyName String?   @db.VarChar(80)
  // ...
}

enum UserRole {
  PRIVATE
  AGENT
  PARTNER      // ZACHOWAJ — bo istniejące konta partnerów (z WWW)
  AGENCY       // już z tym żyją.
  ADMIN
}
```

> **Nie usuwaj** wartości `PARTNER` / `AGENCY` / `ADMIN` z enum — mogą
> już istnieć konta na produkcji. Po prostu **nie pozwalaj** ich utworzyć
> przez `POST /api/register` (walidacja z pkt 1).

### 4. Zapis w DB

```ts
// Pseudo-kod (Prisma)
await prisma.user.create({
  data: {
    email: body.email,
    password: await bcrypt.hash(body.password, 12),
    name: body.name,
    phone: body.phone,
    role: body.role,                                   // 'PRIVATE' lub 'AGENT'
    companyName: body.role === 'AGENT'
      ? body.companyName.trim()
      : null,
  },
});
```

### 5. Zwrot użytkownika w API

Wszystkie endpointy zwracające usera (`GET /api/mobile/v1/user/me`,
`POST /api/auth/login`, `POST /api/register`) muszą dorzucić nowe pole:

```json
{
  "id": 156,
  "email": "...",
  "name": "Anna Kowalska",
  "role": "AGENT",
  "companyName": "Nieruchomości Warszawa Sp. z o.o.",
  // ... reszta jak dziś
}
```

Dla `role !== 'AGENT'` pole `companyName` zwracaj jako `null`
(nie pomijaj — frontend testuje przez `===`).

---

## Konsekwencje wizualne (frontend — TODO osobny ticket)

Po wdrożeniu backendu mobilna apka będzie pokazywać `companyName`
w miejscach gdzie obecnie pokazuje samo imię/nazwisko właściciela:

- karta oferty (`OfferDetail.tsx` — pod imieniem właściciela: 
  „**Anna Kowalska** · _Nieruchomości Warszawa_")
- Radar (pod pinem — subtle podtekst z biurem)
- Dealroom (w nagłówku rozmowy)
- Wizytówka profilu publicznego

To są zmiany frontendu, które zrobimy po wdrożeniu backendu — żeby
dane były spójne we wszystkich screenach.

---

## Test plan dla backendu

1. **Rejestracja PRIVATE bez companyName** — `201 Created`, user
   zapisany z `companyName: null`.
2. **Rejestracja PRIVATE z companyName** — `201 Created`, ale
   `companyName` w DB jest `null` (zignorowane).
3. **Rejestracja AGENT bez companyName** — `400 COMPANY_NAME_REQUIRED`.
4. **Rejestracja AGENT z pustym companyName** (`""` / `"  "`) — `400`.
5. **Rejestracja AGENT z "AB"** (2 znaki) — `201 Created`.
6. **Rejestracja AGENT z 81 znakami** — `400` (max 80).
7. **Rejestracja z role: "PARTNER"** — `400 INVALID_ROLE`.
8. **Rejestracja z role: "ADMIN"** — `400 INVALID_ROLE`.
9. **GET /api/mobile/v1/user/me** dla AGENTA — w odpowiedzi pole
   `companyName` z poprawną wartością.
10. **GET /api/mobile/v1/user/me** dla PRIVATE — `companyName: null`.

---

## Czego NIE robić

- ❌ **Nie usuwaj** roli `PARTNER` z bazy / enum — istniejące konta.
- ❌ **Nie używaj** tej samej walidacji dla `PARTNER` i `AGENT` —
  to są dwie osobne ścieżki onboardingu.
- ❌ **Nie wymagaj** NIP / REGON na tym etapie — to dojdzie później
  (osobny ticket „weryfikacja agenta"). Na razie tylko `companyName`.
