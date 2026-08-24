const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  try {
    console.log('Limpando itens de requisição...');
    await prisma.itemRequisicao.deleteMany({});
    
    console.log('Limpando histórico de avarias...');
    await prisma.historicoAvaria.deleteMany({});
    
    console.log('Limpando requisições...');
    await prisma.requisicao.deleteMany({});
    
    console.log('Limpando reservas de locais...');
    await prisma.reservaLocal.deleteMany({});
    
    console.log('Resetando status dos equipamentos para DISPONIVEL...');
    await prisma.equipamento.updateMany({
      data: { statusCondicao: 'DISPONIVEL', quantidadeUso: 0 }
    });
    
    console.log('Limpeza concluída com sucesso! Banco de dados pronto para testes.');
  } catch (err) {
    console.error('Erro na limpeza:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
