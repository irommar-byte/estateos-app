const fs = require('fs');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
    console.log('1. Aktualizacja schematu bazy danych...');
    let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
    if (!schema.includes('role      String')) {
        schema = schema.replace(/model User \{/, 'model User {\n  role      String   @default("user")');
        fs.writeFileSync('prisma/schema.prisma', schema);
    }

    console.log('2. Wypychanie zmian do bazy...');
    execSync('npx prisma db push', { stdio: 'inherit' });

    console.log('3. Tworzenie Głównego Administratora...');
    const prisma = new PrismaClient();
    let user = await prisma.user.findUnique({ where: { email: 'irommar@me.com' } });
    if (!user) {
        user = await prisma.user.create({
            data: { email: 'irommar@me.com', password: 'admin', name: 'CEO' }
        });
    }
    await prisma.user.update({
        where: { email: 'irommar@me.com' },
        data: { role: 'admin' }
    });
    console.log('✅ SUKCES: irommar@me.com ma teraz uprawnienia Administratora!');
    await prisma.$disconnect();
}
main().catch(console.error);
