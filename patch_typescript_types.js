const fs = require('fs');
const path = require('path');

function fixTypesInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixTypesInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let code = fs.readFileSync(fullPath, 'utf8');
      let original = code;

      // 1. Zamiana String() na Number() dla kluczy relacyjnych
      const idFields = ['buyerId', 'sellerId', 'offerId', 'userId', 'targetId', 'reviewerId', 'agencyId', 'ownerId'];
      idFields.forEach(field => {
        // Zmiana np. buyerId: String(x) -> buyerId: Number(x)
        const regex1 = new RegExp(`${field}\\s*:\\s*String\\(([^)]+)\\)`, 'g');
        code = code.replace(regex1, `${field}: Number($1)`);

        // Zmiana porównań np. buyerId !== String(x) -> buyerId !== Number(x)
        const regex2 = new RegExp(`${field}\\s*(!==|===|!=|==)\\s*String\\(([^)]+)\\)`, 'g');
        code = code.replace(regex2, `${field} $1 Number($2)`);
      });

      // 2. Naprawa zmiennych wstawianych bezpośrednio bez castowania
      code = code.replace(/offerId:\s*offerId(,?)/g, 'offerId: Number(offerId)$1');
      code = code.replace(/buyerId:\s*finalBuyerId(,?)/g, 'buyerId: Number(finalBuyerId)$1');
      code = code.replace(/buyerId:\s*email(,?)/g, 'buyerId: Number(email) || 0$1');
      code = code.replace(/sellerId:\s*email(,?)/g, 'sellerId: Number(email) || 0$1');
      code = code.replace(/buyerId:\s*finalUserId(,?)/g, 'buyerId: Number(finalUserId)$1');
      code = code.replace(/sellerId:\s*finalUserId(,?)/g, 'sellerId: Number(finalUserId)$1');
      code = code.replace(/userId:\s*finalUserId(,?)/g, 'userId: Number(finalUserId)$1');
      code = code.replace(/userId:\s*targetUserId(,?)/g, 'userId: Number(targetUserId)$1');
      code = code.replace(/targetId:\s*userIdStr(,?)/g, 'targetId: Number(userIdStr)$1');
      code = code.replace(/sellerId:\s*userIdStr(,?)/g, 'sellerId: Number(userIdStr)$1');
      code = code.replace(/buyerId:\s*userIdStr(,?)/g, 'buyerId: Number(userIdStr)$1');
      code = code.replace(/targetId:\s*targetId(,?)/g, 'targetId: Number(targetId)$1');

      // 3. Naprawa tablic (operator IN) - np. { in: userIds } -> { in: userIds.map(Number) }
      code = code.replace(/in:\s*userIds\s*\}/g, 'in: userIds.map(Number) }');
      code = code.replace(/in:\s*myOfferIds\s*\}/g, 'in: myOfferIds.map(Number) }');
      code = code.replace(/in:\s*contactIdsAsStrings\s*\}/g, 'in: contactIdsAsStrings.map(Number) }');

      // 4. Przypadki specjalne z .includes() i dziwnymi warunkami
      code = code.replace(/item\.buyerId\.includes/g, 'String(item.buyerId).includes');
      code = code.replace(/item\.sellerId\.includes/g, 'String(item.sellerId).includes');
      code = code.replace(/currentUserId\s*===\s*String\(appointment\.sellerId\)/g, 'Number(currentUserId) === appointment.sellerId');
      code = code.replace(/app\.buyerId\s*===\s*String\(user\.id\)/g, 'app.buyerId === Number(user.id)');

      if (code !== original) {
        fs.writeFileSync(fullPath, code);
      }
    }
  }
}

fixTypesInDir('src/app/api');
console.log('✔ SUKCES: Zakończono automatyczną konwersję typów w katalogu API.');
