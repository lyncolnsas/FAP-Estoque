import { Router } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, authRole } from '../middleware/auth';

const router = Router();

router.get('/geral', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    // Resumo
    const totalEquipamentos = await prisma.equipamento.count();
    const equipamentosComDefeito = await prisma.equipamento.count({ 
      where: { 
        OR: [
          { statusCondicao: 'COM_DEFEITO' },
          { statusCondicao: 'EM_MANUTENCAO' },
          { historicoAvarias: { some: { resolvido: false } } }
        ] 
      } 
    });
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
          orderBy: { dataRegistro: 'desc' },
          include: {
            tipoAvaria: true
          }
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
        usuario: true,
        local: true
      }
    });

    // Histórico Detalhado de Empréstimos e Devoluções (Todas as requisições e reservas)
    const todasRequisicoesCompletas = await prisma.requisicao.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        itens: { include: { equipamento: true } },
        usuario: true,
        local: true,
        historicoAvarias: { include: { equipamento: true } }
      }
    });

    const reservasLocaisDb = await prisma.reservaLocal.findMany({
      orderBy: { dataInicio: 'desc' },
      include: {
        local: true,
        usuario: true
      }
    });

    const historicoEmprestimosDetalhado: any[] = [];

    todasRequisicoesCompletas.forEach(req => {
      // Agrupar itens por nome do equipamento
      const itensAgrupadosMap: Record<string, { nome: string, total: number, avariasCount: number, avarias: string[] }> = {};
      
      req.itens.forEach(it => {
        const nomeEq = it.equipamento?.nome || 'Equipamento';
        if (!itensAgrupadosMap[nomeEq]) {
          itensAgrupadosMap[nomeEq] = { nome: nomeEq, total: 0, avariasCount: 0, avarias: [] };
        }
        itensAgrupadosMap[nomeEq].total += 1;
        
        // Verifica se houve avaria registrada para esse item nesta requisição
        const avariasDesteItem = (req.historicoAvarias || []).filter(h => h.equipamentoId === it.equipamentoId);
        if (avariasDesteItem.length > 0) {
          itensAgrupadosMap[nomeEq].avariasCount += avariasDesteItem.length;
          itensAgrupadosMap[nomeEq].avarias.push(...avariasDesteItem.map(a => a.descricao));
        }
      });

      const itensAgrupados = Object.values(itensAgrupadosMap);
      const totalAvarias = itensAgrupados.reduce((acc, i) => acc + i.avariasCount, 0);

      historicoEmprestimosDetalhado.push({
        id: req.id,
        tipo: req.localId && req.itens.length > 0 ? 'COMPLETO' : (req.localId ? 'RESERVA_ESPACO' : 'MATERIAIS'),
        solicitanteNome: req.solicitanteNome || req.usuario?.nome || 'Desconhecido',
        departamento: req.departamento || req.usuario?.departamento || 'Geral',
        solicitanteWhatsapp: req.solicitanteWhatsapp || req.usuario?.whatsapp || null,
        localNome: req.local?.nome || null,
        dataInicioEvento: req.dataInicioEvento,
        dataFimEvento: req.dataFimEvento,
        horarioOrganizacao: req.horarioOrganizacao,
        dataSaida: req.dataEntrega || req.dataInicioEvento || req.criadoEm,
        operadorSaida: req.operadorEntrega || 'Estoque',
        dataRetorno: ['DEVOLVIDO', 'CANCELADO'].includes(req.status) ? (req.dataDevolucao || req.atualizadoEm) : null,
        operadorRetorno: ['DEVOLVIDO', 'CANCELADO'].includes(req.status) ? (req.operadorDevolucao || 'Estoque') : null,
        status: req.status,
        totalItens: req.itens.length,
        itensAgrupados,
        totalAvarias,
        criadoEm: req.criadoEm
      });
    });

    reservasLocaisDb.forEach(res => {
      // Se não for id de requisição já processada
      if (!historicoEmprestimosDetalhado.some(h => h.id === res.id)) {
        historicoEmprestimosDetalhado.push({
          id: res.id,
          tipo: 'RESERVA_ESPACO',
          solicitanteNome: res.usuario?.nome || 'Desconhecido',
          departamento: res.usuario?.departamento || 'Reserva de Espaço',
          solicitanteWhatsapp: res.usuario?.whatsapp || null,
          localNome: res.local?.nome || 'Espaço',
          dataInicioEvento: res.dataInicio,
          dataFimEvento: res.dataFim,
          horarioOrganizacao: null,
          dataSaida: res.dataInicio,
          operadorSaida: 'Sistema / Reserva',
          dataRetorno: ['CONFIRMADA', 'FINALIZADA', 'DEVOLVIDO'].includes(res.status) && new Date(res.dataFim) < new Date() ? res.dataFim : null,
          operadorRetorno: ['CONFIRMADA', 'FINALIZADA', 'DEVOLVIDO'].includes(res.status) && new Date(res.dataFim) < new Date() ? 'Concluído' : null,
          status: res.status,
          totalItens: 0,
          itensAgrupados: [],
          totalAvarias: 0,
          criadoEm: res.criadoEm
        });
      }
    });

    historicoEmprestimosDetalhado.sort((a, b) => new Date(b.dataSaida || b.criadoEm).getTime() - new Date(a.dataSaida || a.criadoEm).getTime());

    // Lista Completa de Solicitantes (Usuários e Avulsos) com métricas detalhadas
    const usuariosDb = await prisma.usuario.findMany({
      include: {
        requisicoes: {
          include: { itens: true }
        }
      },
      orderBy: { nome: 'asc' }
    });

    const solicitantes = usuariosDb.map(u => {
      const totalReqs = u.requisicoes.length;
      const totalItens = u.requisicoes.reduce((acc, r) => acc + r.itens.length, 0);
      const itensAtivos = u.requisicoes
        .filter(r => ['EMPRESTADO', 'EM_SEPARACAO', 'AGUARDANDO_ACEITE'].includes(r.status))
        .reduce((acc, r) => acc + r.itens.filter(it => !it.statusDevolucao).length, 0);

      return {
        id: u.id,
        nome: u.nome,
        departamento: u.departamento || 'Geral',
        whatsapp: u.whatsapp,
        fotoPerfilUrl: u.fotoPerfilUrl,
        corPersonalizada: u.corPersonalizada,
        role: u.role,
        isAvulso: u.role === 'AVULSO',
        criadoEm: u.criadoEm,
        totalRequisicoes: totalReqs,
        totalItensEmprestados: totalItens,
        itensAtivos
      };
    }).sort((a, b) => b.totalRequisicoes - a.totalRequisicoes);

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
      solicitantes,
      historicoAvarias,
      requisicoes,
      historicoEmprestimosDetalhado
    });
  } catch (error) {
    console.error('Erro ao gerar relatório geral:', error);
    res.status(500).json({ error: 'Erro interno ao gerar relatório' });
  }
});

export default router;
