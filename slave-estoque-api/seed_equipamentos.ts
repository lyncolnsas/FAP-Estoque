import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categorias = await prisma.categoria.findMany({ include: { tipos: true } });
  
  if (categorias.length === 0) {
    console.log("Nenhuma categoria encontrada. Por favor, crie categorias antes de rodar o seed.");
    return;
  }

  for (const cat of categorias) {
    for (const tipo of cat.tipos) {
      console.log(`Gerando equipamentos para: ${cat.nome} -> ${tipo.nome}`);
      
      for (let i = 1; i <= 3; i++) {
        const codigo = `${tipo.nome.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await prisma.equipamento.create({
          data: {
            codigoPatrimonio: codigo,
            nome: `${tipo.nome} Modelo ${['X', 'Pro', 'Max'][i-1]}`,
            categoriaId: cat.id,
            tipoId: tipo.id,
            statusCondicao: 'DISPONIVEL'
          }
        });
        console.log(`  Criado: ${codigo}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
