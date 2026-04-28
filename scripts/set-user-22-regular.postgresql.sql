-- Konto standardowe dla użytkownika id = 22 (PostgreSQL / typowe mapowanie Prisma → "User").
-- Zweryfikuj nazwę tabely w schema.prisma (czasem @@map("users")) i enum planType na produkcji.
-- Po wykonaniu: wyloguj i zaloguj w aplikacji lub przywróć sesję odświeżeniem konta.

BEGIN;

UPDATE "User"
SET
  "role" = 'USER',
  "isPro" = false,
  "proExpiresAt" = NULL,
  "planType" = 'NONE',
  "extraListings" = 0
WHERE id = 22;

COMMIT;
