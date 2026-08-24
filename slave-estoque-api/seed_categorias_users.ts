import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Buscando usuários SETOR e categorias...');
  const usuarios = await prisma.usuario.findMany({ where: { role: 'SETOR' } });
  const categorias = await prisma.categoria.findMany();

  if (categorias.length === 0 || usuarios.length === 0) {
    console.log('Nenhum usuário SETOR ou nenhuma categoria encontrada. Nada a fazer.');
    return;
  }

  const categoriaIds = categorias.map((c) => ({ id: c.id }));

  for (const user of usuarios) {
    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        categoriasPermitidas: {
          connect: categoriaIds
        }
      }
    });
    console.log(`Usuário ${user.email} vinculado a ${categoriaIds.length} categorias.`);
  }

  console.log('Concluído!');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
