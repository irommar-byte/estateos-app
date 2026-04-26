const fs = require('fs');

function replaceInFile(filePath, replacements) {
  let code = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(([search, replace]) => {
    code = code.replace(search, replace);
  });
  fs.writeFileSync(filePath, code);
}

// 1. Naprawa w api/appointments/check-turn/route.ts
replaceInFile('src/app/api/appointments/check-turn/route.ts', [
  [/Number\(currentUserId\) === appointment\.sellerId \|\| currentUserId === appointment\.sellerId/g, 'Number(currentUserId) === appointment.sellerId']
]);

// 2. Naprawa w api/crm/data/route.ts
replaceInFile('src/app/api/crm/data/route.ts', [
  [/contactEmails\.add\(item\.buyerId\)/g, "contactEmails.add(String(item.buyerId))"],
  [/contactIds\.add\(item\.buyerId\)/g, "contactIds.add(String(item.buyerId))"],
  [/contactEmails\.add\(item\.sellerId\)/g, "contactEmails.add(String(item.sellerId))"],
  [/contactIds\.add\(item\.sellerId\)/g, "contactIds.add(String(item.sellerId))"]
]);

// 3. Naprawa w api/reviews/pending/route.ts
replaceInFile('src/app/api/reviews/pending/route.ts', [
  [/id: parseInt\(targetId\)/g, 'id: Number(targetId)']
]);

console.log('✔ SUKCES: Ostatnie 6 błędów naprawione!');
