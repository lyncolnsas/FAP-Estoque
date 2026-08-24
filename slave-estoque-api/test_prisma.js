const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const res = await prisma.configuracao.upsert({
      where: { chave: 'sync_password' },
      update: { valor: '1234' },
      create: { chave: 'sync_password', valor: '1234' }
    });
    console.log('Sucesso:', res);
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
