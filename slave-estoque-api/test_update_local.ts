import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const locais = await prisma.local.findMany();
  if (locais.length > 0) {
    const local = locais[0];
    console.log("Local a atualizar:", local.id, local.nome, local.capacidade);
    
    try {
      const updated = await prisma.local.update({
        where: { id: local.id },
        data: { nome: local.nome, capacidade: local.capacidade }
      });
      console.log("Sucesso!", updated);
    } catch (e) {
      console.error("Erro Prisma:", e);
    }
  } else {
    console.log("Sem locais");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
