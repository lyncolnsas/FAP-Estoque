const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.itemRequisicao.deleteMany();
  await prisma.requisicao.deleteMany();
  await prisma.reservaLocal.deleteMany();
  console.log('Todas as solicitacoes e reservas foram limpas.');
}

main().finally(() => prisma.$disconnect());
