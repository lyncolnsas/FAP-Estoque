import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Populando o banco de dados com itens de exemplo...');

  const equipamentos = [
    {
      codigoPatrimonio: 'MIC-001',
      nome: 'Microfone Sem Fio Shure SM58',
      categoria: 'Áudio',
      statusCondicao: 'DISPONIVEL',
    },
    {
      codigoPatrimonio: 'MIC-002',
      nome: 'Microfone Sem Fio Shure SM58',
      categoria: 'Áudio',
      statusCondicao: 'COM_AVARIA',
    },
    {
      codigoPatrimonio: 'LUZ-001',
      nome: 'Refletor LED RGBW 54x3W',
      categoria: 'Iluminação',
      statusCondicao: 'DISPONIVEL',
    },
    {
      codigoPatrimonio: 'CAB-001',
      nome: 'Cabo XLR 10 Metros',
      categoria: 'Cabos',
      statusCondicao: 'DISPONIVEL',
    },
    {
      codigoPatrimonio: 'CAM-001',
      nome: 'Câmera Sony A7III',
      categoria: 'Vídeo',
      statusCondicao: 'COM_DEFEITO', // Este não deve aparecer na lista ou ser bloqueado pelo leitor
    }
  ];

  for (const eq of equipamentos) {
    await prisma.equipamento.upsert({
      where: { codigoPatrimonio: eq.codigoPatrimonio },
      update: {},
      create: eq,
    });
  }

  console.log('Itens inseridos com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
