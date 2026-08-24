import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const reqs = await prisma.requisicao.findMany();
  console.log(reqs.map(r => ({ id: r.id, nome: r.solicitanteNome, status: r.status })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
