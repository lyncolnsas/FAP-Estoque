import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, authRole, AuthRequest } from '../middleware/auth';

const categoriasRoutes = Router();
const prisma = new PrismaClient();

// ==========================================
// CATEGORIAS
// ==========================================

// GET /categorias - Lista todas as categorias e seus tipos
categoriasRoutes.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userRole = req.user?.role;
    let whereClause = {};

    if (userRole === 'SETOR') {
      whereClause = {
        usuariosPermitidos: {
          some: { id: req.user?.id }
        }
      };
    }

    const categorias = await prisma.categoria.findMany({
      where: whereClause,
      include: {
        tipos: true
      },
      orderBy: { nome: 'asc' }
    });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar categorias' });
  }
});

// POST /categorias - Cria uma nova categoria
categoriasRoutes.post('/', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'O nome da categoria é obrigatório' });

    const categoriaExistente = await prisma.categoria.findUnique({ where: { nome } });
    if (categoriaExistente) {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
    }

    const categoria = await prisma.categoria.create({
      data: { nome }
    });
    res.status(201).json(categoria);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// PUT /categorias/:id - Edita uma categoria
categoriasRoutes.put('/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nome } = req.body;
    
    const categoria = await prisma.categoria.update({
      where: { id },
      data: { nome }
    });
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// DELETE /categorias/:id - Exclui uma categoria
categoriasRoutes.delete('/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.categoria.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Categoria excluída' });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Não é possível excluir a categoria pois há equipamentos ou tipos vinculados a ela.' });
    }
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
});

// ==========================================
// TIPOS DE EQUIPAMENTO
// ==========================================

// POST /categorias/:categoriaId/tipos - Adiciona um tipo à categoria
categoriasRoutes.post('/:categoriaId/tipos', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const categoriaId = req.params.categoriaId as string;
    const { nome } = req.body;

    if (!nome) return res.status(400).json({ error: 'O nome do tipo é obrigatório' });

    const tipo = await prisma.tipoEquipamento.create({
      data: { nome, categoriaId }
    });
    res.status(201).json(tipo);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar tipo de equipamento' });
  }
});

// PUT /tipos/:id - Edita um tipo
categoriasRoutes.put('/tipos/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nome } = req.body;
    
    const tipo = await prisma.tipoEquipamento.update({
      where: { id },
      data: { nome }
    });
    res.json(tipo);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar tipo' });
  }
});

// DELETE /tipos/:id - Exclui um tipo
categoriasRoutes.delete('/tipos/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.tipoEquipamento.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Tipo excluído' });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Não é possível excluir o tipo pois há equipamentos vinculados a ele.' });
    }
    res.status(500).json({ error: 'Erro ao excluir tipo' });
  }
});

export default categoriasRoutes;
