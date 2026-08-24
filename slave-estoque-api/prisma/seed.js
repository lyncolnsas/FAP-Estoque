const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Criando usuário administrador inicial...');

  const senhaHash = await bcrypt.hash('123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@admin.com' },
    update: {
      senhaHash
    },
    create: {
      nome: 'Administrador Padrão',
      email: 'admin@admin.com',
      senhaHash,
      role: 'ADMIN',
      departamento: 'TI',
    },
  });

  console.log('Administrador criado com sucesso:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
