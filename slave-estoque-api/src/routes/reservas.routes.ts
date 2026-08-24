import { Router } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, authRole } from '../middleware/auth';
import { whatsapp } from '../whatsapp';

const reservasRoutes = Router();

// GET /reservas-locais
// Retorna todas as reservas agrupando pendentes e confirmadas (visível para qualquer autenticado)
reservasRoutes.get('/', authMiddleware, async (req, res) => {
  try {
    const reservas = await prisma.reservaLocal.findMany({
      include: {
        local: true,
        usuario: { select: { id: true, nome: true, email: true, departamento: true, corPersonalizada: true } }
      },
      orderBy: { dataInicio: 'asc' }
    });

    res.json(reservas);
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas de locais' });
  }
});

// GET /reservas-locais/me
// Retorna reservas do proprio usuario logado
reservasRoutes.get('/me', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const reservas = await prisma.reservaLocal.findMany({
      where: { usuarioId: userId },
      include: { local: true },
      orderBy: { dataInicio: 'desc' }
    });

    res.json(reservas);
  } catch (error) {
    console.error('Erro ao buscar reservas do usuario:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

// PUT /reservas-locais/:id
// Edita uma reserva existente
reservasRoutes.put('/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { status, dataInicio, dataFim, localId } = req.body;

    const reservaAtual = await prisma.reservaLocal.findUnique({ where: { id } });
    if (!reservaAtual) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    // Se estiver confirmando ou alterando datas de uma confirmada, checar conflito
    if (status === 'CONFIRMADA' || (reservaAtual.status === 'CONFIRMADA' && status !== 'CANCELADA')) {
      const start = new Date(dataInicio || reservaAtual.dataInicio);
      const end = new Date(dataFim || reservaAtual.dataFim);
      const targetLocalId = localId || reservaAtual.localId;

      const conflitos = await prisma.reservaLocal.findMany({
        where: {
          id: { not: id },
          localId: targetLocalId,
          status: { in: ['AGUARDANDO', 'CONFIRMADA'] },
          dataInicio: { lt: end },
          dataFim: { gt: start }
        }
      });

      if (conflitos.length > 0) {
        return res.status(400).json({ error: 'Já existe uma reserva confirmada para este local neste horário.' });
      }
    }

    const data: any = {};
    if (status) data.status = status;
    if (dataInicio) data.dataInicio = new Date(dataInicio);
    if (dataFim) data.dataFim = new Date(dataFim);
    if (localId) data.localId = localId;

    const reservaAtualizada = await prisma.reservaLocal.update({
      where: { id },
      data,
      include: {
        local: true,
        usuario: { select: { id: true, nome: true, email: true, departamento: true, whatsapp: true } }
      }
    });

    if (status && (status === 'CONFIRMADA' || status === 'CANCELADA' || status === 'RECUSADA')) {
      const num = reservaAtualizada.usuario.whatsapp;
      if (num) {
        const waNum = num.replace(/\D/g, '') + '@s.whatsapp.net';
        const statusText = status === 'CONFIRMADA' ? 'AUTORIZADA' : 'RECUSADA';
        const msg = `Olá, ${reservaAtualizada.usuario.nome}! Sua solicitação de reserva para o espaço: *${reservaAtualizada.local.nome}* foi *${statusText}*.`;
        
        if (reservaAtualizada.local.fotoUrl) {
          whatsapp.sendMediaMessage(waNum, reservaAtualizada.local.fotoUrl, msg).catch(console.error);
        } else {
          whatsapp.sendMessage(waNum, msg).catch(console.error);
        }
      }
    }

    res.json(reservaAtualizada);
  } catch (error) {
    console.error('Erro ao atualizar reserva:', error);
    res.status(500).json({ error: 'Erro ao atualizar reserva de local' });
  }
});

export default reservasRoutes;
