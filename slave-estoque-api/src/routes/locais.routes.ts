import { Router } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, authRole, AuthRequest } from '../middleware/auth';

const locaisRoutes = Router();

locaisRoutes.post('/', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { nome, capacidade, fotoUrl } = req.body;
    const local = await prisma.local.create({
      data: { nome, capacidade: Number(capacidade), fotoUrl }
    });
    res.status(201).json(local);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao criar local' });
  }
});

locaisRoutes.get('/', authMiddleware, async (req, res) => {
  const locais = await prisma.local.findMany({
    orderBy: { nome: 'asc' }
  });
  res.json(locais);
});

// Checa a disponibilidade para um período específico
locaisRoutes.get('/disponibilidade', authMiddleware, async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) return res.status(400).json({ error: 'Datas inválidas' });

    const dataInicio = new Date(inicio as string);
    const dataFim = new Date(fim as string);

    // Buscar todos os locais
    const todosLocais = await prisma.local.findMany();

    // Buscar locais com reservas conflitantes (apenas confirmadas)
    // Conflito: inicioReserva < dataFim AND fimReserva > dataInicio
    const locaisOcupados = await prisma.reservaLocal.findMany({
      where: {
        status: 'CONFIRMADA',
        dataInicio: { lt: dataFim },
        dataFim: { gt: dataInicio }
      },
      select: { localId: true }
    });

    const ocupadosIds = locaisOcupados.map(r => r.localId);
    
    // Mapear os locais disponíveis
    const disponiveis = todosLocais.filter(l => !ocupadosIds.includes(l.id));

    res.json(disponiveis);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
  }
});

locaisRoutes.put('/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { nome, capacidade, fotoUrl } = req.body;
    const data: any = { nome, capacidade: Number(capacidade) };
    if (fotoUrl !== undefined) data.fotoUrl = fotoUrl;

    const local = await prisma.local.update({
      where: { id: req.params.id as string },
      data
    });
    res.json(local);
  } catch (error: any) {
    console.error('ERRO AO ATUALIZAR LOCAL:', error);
    res.status(400).json({ error: 'Erro ao atualizar local', details: error?.message });
  }
});

locaisRoutes.delete('/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    await prisma.local.delete({
      where: { id: req.params.id as string }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Erro ao excluir local. Pode haver reservas vinculadas.' });
  }
});

export default locaisRoutes;