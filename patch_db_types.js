const fs = require('fs');
const path = 'prisma/schema.prisma';
let code = fs.readFileSync(path, 'utf8');

const updates = {
  'Appointment': ['offerId', 'buyerId', 'sellerId'],
  'Bid': ['offerId', 'buyerId', 'sellerId'],
  'Notification': ['userId'],
  'Review': ['reviewerId', 'targetId'],
  'LeadTransfer': ['ownerId', 'agencyId']
};

for (const [model, fields] of Object.entries(updates)) {
  const regex = new RegExp(`(model ${model} \\{[\\s\\S]*?\\})`);
  code = code.replace(regex, (match) => {
    let updatedBlock = match;
    fields.forEach(field => {
      // Zamienia np. "buyerId String" na "buyerId Int"
      const fieldRegex = new RegExp(`(${field}\\s+)String(\\??)`);
      updatedBlock = updatedBlock.replace(fieldRegex, `$1Int$2`);
    });
    return updatedBlock;
  });
}

fs.writeFileSync(path, code);
console.log('✔ SUKCES: Zaktualizowano typy w pliku schema.prisma.');
