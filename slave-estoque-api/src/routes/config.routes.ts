import { Router } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, authRole } from '../middleware/auth';
import { whatsapp } from '../whatsapp';

const configRoutes = Router();

// --- E-MAIL SMTP ---
configRoutes.get('/email', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const configs = await prisma.configuracao.findMany();
    const map = configs.reduce<Record<string, string>>((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {});
    res.json({
      smtpHost: map['smtp_host'] || '',
      smtpPort: map['smtp_port'] || '',
      smtpUser: map['smtp_user'] || '',
      smtpPass: map['smtp_pass'] ? '******' : '' // Não expor a senha real
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

configRoutes.post('/email', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;
    
    await prisma.configuracao.upsert({ where: { chave: 'smtp_host' }, update: { valor: smtpHost }, create: { chave: 'smtp_host', valor: smtpHost } });
    await prisma.configuracao.upsert({ where: { chave: 'smtp_port' }, update: { valor: smtpPort }, create: { chave: 'smtp_port', valor: smtpPort } });
    await prisma.configuracao.upsert({ where: { chave: 'smtp_user' }, update: { valor: smtpUser }, create: { chave: 'smtp_user', valor: smtpUser } });
    
    if (smtpPass && smtpPass !== '******') {
      await prisma.configuracao.upsert({ where: { chave: 'smtp_pass' }, update: { valor: smtpPass }, create: { chave: 'smtp_pass', valor: smtpPass } });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// --- WHATSAPP ---
configRoutes.get('/whatsapp/status', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  // Pegamos o estado interno do whatsapp do arquivo de classe global
  const status = (global as any).whatsappStatus || 'DESCONECTADO';
  const qr = (global as any).whatsappQrCode || null;
  res.json({ status, qr });
});

configRoutes.post('/whatsapp/reconectar', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    await whatsapp.reconnect();
    res.json({ success: true, message: 'Reconectando ao WhatsApp...' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao tentar reconectar' });
  }
});

configRoutes.post('/whatsapp/desconectar', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    await whatsapp.disconnect();
    res.json({ success: true, message: 'Sessão do WhatsApp encerrada.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao tentar desconectar' });
  }
});

export default configRoutes;
