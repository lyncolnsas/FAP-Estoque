import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, authRole, AuthRequest } from '../middleware/auth';
import { whatsapp } from '../whatsapp';

const authRoutes = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// ─── Login ───────────────────────────────────────────────────────────────────
authRoutes.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha } = req.body;

    const user = await prisma.usuario.findFirst({
      where: { OR: [{ email }, { nome: email }] }
    });
    if (!user) { res.status(401).json({ error: 'Credenciais inválidas' }); return; }

    const isValid = await bcrypt.compare(senha, user.senhaHash);
    if (!isValid) { res.status(401).json({ error: 'Credenciais inválidas' }); return; }

    const token = jwt.sign(
      { id: user.id, role: user.role, departamento: user.departamento },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role, departamento: user.departamento } });
  } catch (error) {
    console.error('Erro detalhado no login:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ─── Cadastro de usuário (somente ADMIN) ─────────────────────────────────────
authRoutes.post('/register', authMiddleware, authRole(['ADMIN']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, email, senha, departamento, whatsapp: userWhatsapp, categoriasPermitidas, role } = req.body;

    const exists = await prisma.usuario.findUnique({ where: { email } });
    if (exists) { res.status(400).json({ error: 'Email já cadastrado' }); return; }

    let fotoPerfilUrl = req.body.fotoPerfilUrl || null;
    if (!fotoPerfilUrl && userWhatsapp && (global as any).whatsappStatus === 'CONECTADO') {
      try { fotoPerfilUrl = await whatsapp.getProfilePictureUrl(userWhatsapp); } catch (e) {}
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await prisma.usuario.create({
      data: {
        nome, email, senhaHash,
        role: role || 'SETOR',
        departamento,
        whatsapp: userWhatsapp,
        fotoPerfilUrl,
        ...(categoriasPermitidas && {
          categoriasPermitidas: { connect: categoriasPermitidas.map((id: string) => ({ id })) }
        })
      }
    });

    res.status(201).json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// ─── Retornar usuário autenticado ─────────────────────────────────────────────
authRoutes.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
  const user = await prisma.usuario.findUnique({
    where: { id: req.user.id },
    include: { categoriasPermitidas: { select: { id: true, nome: true } } }
  });
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

  res.json({ id: user.id, nome: user.nome, email: user.email, role: user.role, departamento: user.departamento, whatsapp: user.whatsapp, categoriasPermitidas: user.categoriasPermitidas });
});

// ─── Alterar própria senha ────────────────────────────────────────────────────
authRoutes.put('/me/password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }

  try {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) { res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' }); return; }

    const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

    const isValid = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!isValid) { res.status(401).json({ error: 'Senha atual incorreta' }); return; }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({ where: { id: user.id }, data: { senhaHash } });

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// ─── Setup inicial do admin ───────────────────────────────────────────────────
authRoutes.post('/setup-admin', authMiddleware, authRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { novoEmail, novaSenha } = req.body;
    if (!novoEmail || !novaSenha) { res.status(400).json({ error: 'Email e senha são obrigatórios' }); return; }

    const adminOriginal = await prisma.usuario.findFirst({ where: { email: 'admin@admin.com' } });
    if (!adminOriginal) { res.status(400).json({ error: 'Acesso de configuração já foi realizado.' }); return; }

    if (req.user?.id !== adminOriginal.id) { res.status(403).json({ error: 'Apenas a conta de primeiro acesso pode configurar o novo administrador.' }); return; }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({
      where: { id: adminOriginal.id },
      data: { email: novoEmail, senhaHash, nome: 'Administrador Principal' }
    });

    res.json({ success: true, message: 'Administrador configurado com sucesso' });
  } catch (error) {
    console.error('Erro no setup-admin:', error);
    res.status(500).json({ error: 'Erro ao configurar administrador' });
  }
});

// ─── Verificar existência do admin padrão ─────────────────────────────────────
authRoutes.get('/check-default-admin', async (req: Request, res: Response): Promise<void> => {
  try {
    const defaultAdmin = await prisma.usuario.findFirst({ where: { email: 'admin@admin.com' } });
    res.json({ hasDefaultAdmin: !!defaultAdmin });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar admin padrão' });
  }
});

// ─── Listar usuários (ADMIN / ESTOQUISTA) ────────────────────────────────────
authRoutes.get('/users', authMiddleware, authRole(['ADMIN', 'ESTOQUISTA']), async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, role: true, departamento: true, whatsapp: true, fotoPerfilUrl: true, corPersonalizada: true, categoriasPermitidas: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// ─── Atualizar usuário (ADMIN) ────────────────────────────────────────────────
authRoutes.put('/users/:id', authMiddleware, authRole(['ADMIN']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { nome, email, departamento, role, senha, whatsapp: userWhatsapp, corPersonalizada, categoriasPermitidas, fotoPerfilUrl } = req.body;

    const dataToUpdate: any = { nome, email, departamento, role, whatsapp: userWhatsapp, corPersonalizada };
    if (fotoPerfilUrl !== undefined) {
      dataToUpdate.fotoPerfilUrl = fotoPerfilUrl;
    } else if (userWhatsapp && (global as any).whatsappStatus === 'CONECTADO') {
      try {
        const fetched = await whatsapp.getProfilePictureUrl(userWhatsapp);
        if (fetched) dataToUpdate.fotoPerfilUrl = fetched;
      } catch (e) {}
    }

    if (senha && senha.trim() !== '') {
      dataToUpdate.senhaHash = await bcrypt.hash(senha, 10);
    }
    if (categoriasPermitidas) {
      dataToUpdate.categoriasPermitidas = { set: categoriasPermitidas.map((catId: string) => ({ id: catId })) };
    }

    const updatedUser = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      include: { categoriasPermitidas: true }
    });

    res.json({ id: updatedUser.id, nome: updatedUser.nome, email: updatedUser.email, role: updatedUser.role, fotoPerfilUrl: updatedUser.fotoPerfilUrl, corPersonalizada: updatedUser.corPersonalizada, categoriasPermitidas: updatedUser.categoriasPermitidas });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// ─── Excluir usuário (ADMIN) ──────────────────────────────────────────────────
authRoutes.delete('/users/:id', authMiddleware, authRole(['ADMIN']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.reservaLocal.deleteMany({ where: { usuarioId: id } });
    await prisma.requisicao.updateMany({ where: { usuarioId: id }, data: { usuarioId: null } });
    await prisma.usuario.delete({ where: { id } });
    res.json({ success: true, message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// ─── Cadastrar Solicitante Avulso (ADMIN / ESTOQUISTA) ───────────────────────
authRoutes.post('/users/avulso', authMiddleware, authRole(['ADMIN', 'ESTOQUISTA']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, departamento, whatsapp: userWhatsapp } = req.body;
    if (!nome || !nome.trim()) { res.status(400).json({ error: 'Nome do solicitante é obrigatório.' }); return; }

    const cleanName = nome.trim();
    const cleanWa = userWhatsapp ? String(userWhatsapp).trim() : null;

    const existing = await prisma.usuario.findFirst({
      where: {
        OR: [
          { nome: { equals: cleanName } },
          ...(cleanWa ? [{ whatsapp: { equals: cleanWa } }] : [])
        ]
      }
    });

    if (existing) {
      const dataUp: any = {};
      if (departamento && !existing.departamento) dataUp.departamento = departamento.trim();
      if (cleanWa && !existing.whatsapp) dataUp.whatsapp = cleanWa;
      if (cleanWa && !existing.fotoPerfilUrl && (global as any).whatsappStatus === 'CONECTADO') {
        try { const foto = await whatsapp.getProfilePictureUrl(cleanWa); if (foto) dataUp.fotoPerfilUrl = foto; } catch (e) {}
      }
      const updated = Object.keys(dataUp).length > 0
        ? await prisma.usuario.update({ where: { id: existing.id }, data: dataUp })
        : existing;
      res.json({ success: true, user: updated, message: 'Solicitante já existente vinculado.' });
      return;
    }

    const generatedEmail = `avulso_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@estoque.local`;
    const dummyHash = await bcrypt.hash('123456', 10);
    let autoFoto = null;

    if (cleanWa && (global as any).whatsappStatus === 'CONECTADO') {
      try { autoFoto = await whatsapp.getProfilePictureUrl(cleanWa); } catch (e) {}
    }

    const created = await prisma.usuario.create({
      data: {
        nome: cleanName,
        departamento: departamento ? departamento.trim() : 'Geral',
        whatsapp: cleanWa,
        email: generatedEmail,
        senhaHash: dummyHash,
        role: 'AVULSO',
        fotoPerfilUrl: autoFoto
      }
    });

    res.status(201).json({ success: true, user: created });
  } catch (error) {
    console.error('Erro ao criar solicitante avulso:', error);
    res.status(500).json({ error: 'Erro ao cadastrar solicitante avulso.' });
  }
});

// ─── Promover Avulso para usuário com acesso (ADMIN) ─────────────────────────
authRoutes.post('/users/:id/promote', authMiddleware, authRole(['ADMIN']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { email, senha, role, departamento, whatsapp: userWhatsapp, categoriasPermitidas } = req.body;

    if (!email || !senha) { res.status(400).json({ error: 'E-mail de login e senha são obrigatórios para conceder acesso.' }); return; }

    const user = await prisma.usuario.findUnique({ where: { id } });
    if (!user) { res.status(404).json({ error: 'Solicitante não encontrado.' }); return; }

    const emailConflict = await prisma.usuario.findFirst({ where: { email: email.trim().toLowerCase(), id: { not: id } } });
    if (emailConflict) { res.status(400).json({ error: 'Este e-mail de login já está em uso por outro usuário.' }); return; }

    const senhaHash = await bcrypt.hash(senha, 10);
    const targetRole = role || 'SETOR';

    const dataToUpdate: any = {
      email: email.trim().toLowerCase(),
      senhaHash,
      role: targetRole,
      ...(departamento && { departamento: departamento.trim() }),
      ...(userWhatsapp && { whatsapp: userWhatsapp.trim() })
    };

    if (categoriasPermitidas && targetRole === 'SETOR') {
      dataToUpdate.categoriasPermitidas = { set: categoriasPermitidas.map((catId: string) => ({ id: catId })) };
    }

    const waToFetch = userWhatsapp || user.whatsapp;
    if (waToFetch && !user.fotoPerfilUrl && (global as any).whatsappStatus === 'CONECTADO') {
      try { const foto = await whatsapp.getProfilePictureUrl(waToFetch); if (foto) dataToUpdate.fotoPerfilUrl = foto; } catch (e) {}
    }

    const updatedUser = await prisma.usuario.update({ where: { id }, data: dataToUpdate, include: { categoriasPermitidas: true } });

    res.json({ success: true, message: `Acesso liberado com sucesso para ${updatedUser.nome}!`, user: updatedUser });
  } catch (error) {
    console.error('Erro ao conceder acesso ao solicitante:', error);
    res.status(500).json({ error: 'Erro ao conceder acesso ao solicitante.' });
  }
});

// ─── Sincronizar foto de perfil do WhatsApp ───────────────────────────────────
authRoutes.post('/users/:id/sync-photo', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.usuario.findUnique({ where: { id: req.params.id as string } });
    if (!user || !user.whatsapp) { res.status(400).json({ error: 'Usuário sem número de WhatsApp cadastrado.' }); return; }

    const foto = await whatsapp.getProfilePictureUrl(user.whatsapp);
    if (!foto) { res.status(404).json({ error: 'Foto de perfil não encontrada no WhatsApp.' }); return; }

    const updated = await prisma.usuario.update({ where: { id: user.id }, data: { fotoPerfilUrl: foto } });
    res.json({ success: true, fotoPerfilUrl: updated.fotoPerfilUrl });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao sincronizar foto com WhatsApp' });
  }
});

export default authRoutes;
