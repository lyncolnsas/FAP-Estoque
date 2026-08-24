import { Router } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, authRole } from '../middleware/auth';

const router = Router();

router.get('/geral', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    // Resumo
    const totalEquipamentos = await prisma.equipamento.count();
    const equipamentosComDefeito = await prisma.equipamento.count({ where: { statusCondicao: 'COM_DEFEITO' } });
    const equipamentosEmprestados = await prisma.equipamento.count({ where: { statusCondicao: 'EMPRESTADO' } });
    const equipamentosDisponiveis = await prisma.equipamento.count({ where: { statusCondicao: 'DISPONIVEL' } });
    const equipamentosBaixados = await prisma.equipamento.count({ where: { statusCondicao: 'BAIXADO' } });

    // Listagem de Equipamentos com mais detalhes
    const equipamentos = await prisma.equipamento.findMany({
      orderBy: { nome: 'asc' },
      include: {
        categoria: true,
        tipo: true,
        itensRequisicao: {
          where: {
            statusDevolucao: false,
            requisicao: {
              status: { in: ['EM_SEPARACAO', 'AGUARDANDO_ACEITE', 'EMPRESTADO'] }
            }
          },
          include: {
            requisicao: true
          }
        },
        historicoAvarias: {
          orderBy: { dataRegistro: 'desc' }
        }
      }
    });

    // Ranking Usuários (Quem pegou, quantas vezes pegou)
    const todasRequisicoes = await prisma.requisicao.findMany({
      include: { itens: true }
    });

    const rankingUsuariosMap: Record<string, { nome: string, totalRequisicoes: number, totalItensEmprestados: number }> = {};
    todasRequisicoes.forEach(req => {
      const nome = req.solicitanteNome || 'Desconhecido';
      if (!rankingUsuariosMap[nome]) {
        rankingUsuariosMap[nome] = { nome, totalRequisicoes: 0, totalItensEmprestados: 0 };
      }
      rankingUsuariosMap[nome].totalRequisicoes += 1;
      rankingUsuariosMap[nome].totalItensEmprestados += req.itens.length;
    });
    const rankingUsuarios = Object.values(rankingUsuariosMap).sort((a, b) => b.totalRequisicoes - a.totalRequisicoes);

    // Histórico de Avarias (Últimos 30)
    const historicoAvarias = await prisma.historicoAvaria.findMany({
      take: 30,
      orderBy: { dataRegistro: 'desc' },
      include: {
        equipamento: true,
        requisicao: true
      }
    });

    // Requisições Ativas/Pendentes
    const requisicoes = await prisma.requisicao.findMany({
      where: {
        status: { in: ['PENDENTE', 'EM_SEPARACAO', 'AGUARDANDO_ACEITE', 'EMPRESTADO'] }
      },
      orderBy: { dataInicioEvento: 'asc' },
      include: {
        itens: { include: { equipamento: true } },
        usuario: true
      }
    });

    res.json({
      resumo: {
        totalEquipamentos,
        equipamentosComDefeito,
        equipamentosEmprestados,
        equipamentosDisponiveis,
        equipamentosBaixados
      },
      equipamentos,
      rankingUsuarios,
      historicoAvarias,
      requisicoes
    });
  } catch (error) {
    console.error('Erro ao gerar relatório geral:', error);
    res.status(500).json({ error: 'Erro interno ao gerar relatório' });
  }
});

export default router;
