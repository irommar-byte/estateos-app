const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Łączenie z bazą danych...");
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    },
    orderBy: {
      id: 'asc'
    }
  });

  if (users.length === 0) {
    console.log("Baza użytkowników jest pusta.");
  } else {
    console.log(`\nZnaleziono ${users.length} użytkowników w bazie:\n`);
    // Formatujemy dane do czytelnej tabeli
    const tableData = users.map(u => ({
      ID: u.id,
      Email: u.email,
      Imię: u.name || 'Brak',
      Rola: u.role,
      Zarejestrowany: u.createdAt.toISOString().split('T')[0]
    }));
    
    console.table(tableData);
  }
}

main()
  .catch(e => {
    console.error("Wystąpił błąd podczas łączenia z bazą:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
