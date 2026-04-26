const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    
    try {
        console.log('1. Odpinanie ofert od starych kont (żeby nie zniknęły z mapy)...');
        await prisma.offer.updateMany({
            data: { userId: null }
        });

        console.log('2. Trwa kasowanie wszystkich kont użytkowników...');
        await prisma.user.deleteMany({});

        console.log('3. Tworzenie Głównego Administratora...');
        await prisma.user.create({
            data: { 
                email: 'irommar@me.com', 
                password: 'Sexygirl112', 
                name: 'CEO',
                role: 'admin'
            }
        });

        console.log('✅ SUKCES: Baza wyczyszczona. Twoje konto z nowym hasłem jest gotowe!');
    } catch (error) {
        console.error('Wystąpił błąd:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
