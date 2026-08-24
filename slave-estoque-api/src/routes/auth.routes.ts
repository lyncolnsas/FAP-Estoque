import { Router } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, authRole, AuthRequest } from '../middleware/auth';

const authRoutes = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Rota de Login
authRoutes.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body; // 'email' field now holds either email or username

    const user = await prisma.usuario.findFirst({ 
      where: { 
        OR: [
          { email: email },
          { nome: email }
        ]
      } 
    });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const isValid = await bcrypt.compare(senha, user.senhaHash);
    if (!isValid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { id: user.id, role: user.role, departamento: user.departamento },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role, departamento: user.departamento } });
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Cadastro de novos Usuários (Apenas ADMIN pode criar)
authRoutes.post('/register', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { nome, email, senha, departamento, whatsapp, categoriasPermitidas, role } = req.body;
    
    const exists = await prisma.usuario.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email já cadastrado' });

    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        role: role || 'SETOR',
        departamento,
        whatsapp,
        ...(categoriasPermitidas && {
          categoriasPermitidas: {
            connect: categoriasPermitidas.map((id: string) => ({ id }))
          }
        })
      }
    });

    res.status(201).json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// Retornar usuário atual
authRoutes.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  const user = await prisma.usuario.findUnique({ 
    where: { id: req.user.id },
    include: { categoriasPermitidas: { select: { id: true, nome: true } } }
  });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  res.json({ id: user.id, nome: user.nome, email: user.email, role: user.role, departamento: user.departamento, whatsapp: user.whatsapp, categoriasPermitidas: user.categoriasPermitidas });
});

// Alterar senha do perfil restrito (O próprio usuário)
authRoutes.put('/me/password', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  
  try {
    const { senhaAtual, novaSenha } = req.body;
    
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const isValid = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!isValid) return res.status(401).json({ error: 'Senha atual incorreta' });

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    
    await prisma.usuario.update({
      where: { id: user.id },
      data: { senhaHash }
    });

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Configuração do Admin no Primeiro Acesso
authRoutes.post('/setup-admin', authMiddleware, authRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { novoEmail, novaSenha } = req.body;
    if (!novoEmail || !novaSenha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const adminOriginal = await prisma.usuario.findFirst({ where: { email: 'admin@admin.com' } });
    if (!adminOriginal) {
      return res.status(400).json({ error: 'Acesso de configuração já foi realizado.' });
    }

    if (req.user?.id !== adminOriginal.id) {
      return res.status(403).json({ error: 'Apenas a conta de primeiro acesso pode configurar o novo administrador.' });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    
    await prisma.usuario.update({
      where: { id: adminOriginal.id },
      data: {
        email: novoEmail,
        senhaHash: senhaHash,
        nome: 'Administrador Principal'
      }
    });

    res.json({ success: true, message: 'Administrador configurado com sucesso' });
  } catch (error) {
    console.error('Erro no setup-admin:', error);
    res.status(500).json({ error: 'Erro ao configurar administrador' });
  }
});

// Verificar se o admin padrão (admin@admin.com) ainda existe no banco
authRoutes.get('/check-default-admin', async (req, res) => {
  try {
    const defaultAdmin = await prisma.usuario.findFirst({ where: { email: 'admin@admin.com' } });
    res.json({ hasDefaultAdmin: !!defaultAdmin });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar admin padrão' });
  }
});

// Listar todos os usuários (Apenas ADMIN)
authRoutes.get('/users', authMiddleware, authRole(['ADMIN', 'ESTOQUISTA']), async (req, res) => {
  try {
    const users = await prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, role: true, departamento: true, whatsapp: true, corPersonalizada: true, categoriasPermitidas: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Atualizar usuário (Apenas ADMIN)
authRoutes.put('/users/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nome, email, departamento, role, senha, whatsapp, corPersonalizada, categoriasPermitidas } = req.body;
    
    const dataToUpdate: any = { nome, email, departamento, role, whatsapp, corPersonalizada };
    if (senha && senha.trim() !== '') {
      dataToUpdate.senhaHash = await bcrypt.hash(senha, 10);
    }
    
    if (categoriasPermitidas) {
      dataToUpdate.categoriasPermitidas = {
        set: categoriasPermitidas.map((id: string) => ({ id }))
      };
    }
    
    const updatedUser = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      include: { categoriasPermitidas: true }
    });
    
    res.json({ id: updatedUser.id, nome: updatedUser.nome, email: updatedUser.email, role: updatedUser.role, corPersonalizada: updatedUser.corPersonalizada, categoriasPermitidas: updatedUser.categoriasPermitidas });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Excluir usuário (Apenas ADMIN)
authRoutes.delete('/users/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    
    // Deleta os históricos e itens vinculados de reservas/requisições (cascata manual simplificada)
    await prisma.reservaLocal.deleteMany({ where: { usuarioId: id } });
    await prisma.requisicao.updateMany({ where: { usuarioId: id }, data: { usuarioId: null } });
    
    await prisma.usuario.delete({ where: { id } });
    
    res.json({ success: true, message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

export default authRoutes;
