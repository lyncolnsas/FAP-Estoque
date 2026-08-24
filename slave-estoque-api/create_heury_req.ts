import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const req = await prisma.requisicao.create({
    data: {
      solicitanteNome: 'Heury',
      solicitanteEmail: 'heury@teste.com',
      solicitanteWhatsapp: '11999999999',
      departamento: 'TI',
      dataInicioEvento: new Date(),
      dataFimEvento: new Date(),
      dataRetiradaSugerida: new Date(),
      status: 'AGUARDANDO_SEPARACAO',
    }
  });
  console.log('Requisição criada para Heury:', req);
}
main().catch(console.error).finally(() => prisma.$disconnect());
