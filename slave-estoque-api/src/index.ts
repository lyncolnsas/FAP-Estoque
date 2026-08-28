import express from 'express';
import cors from 'cors';
import { prisma } from './prisma';
import { whatsapp } from './whatsapp';
import { authMiddleware, authRole, AuthRequest } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import uploadRoutes from './routes/upload.routes';
import reservasRoutes from './routes/reservas.routes';
import locaisRoutes from './routes/locais.routes';
import configRoutes from './routes/config.routes';
import relatoriosRoutes from './routes/relatorios.routes';
import categoriasRoutes from './routes/categorias.routes';
import syncRoutes from './routes/sync.routes';
import path from 'path';
import { sendEmail } from './email';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../favicon.ico')));

app.use('/auth', authRoutes);
app.use('/usuarios', authRoutes); // Opcional, mantendo compatibilidade
app.use('/reservas-locais', reservasRoutes);
app.use('/upload', uploadRoutes); // Removed authMiddleware for mobile sync
app.use('/locais', locaisRoutes);
app.use('/configuracoes', configRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/categorias', categoriasRoutes);
app.use('/sync', syncRoutes); // Rota de Sincronismo Mobile

// --- WHATSAPP ROUTES ---
app.get('/whatsapp/contacts', authMiddleware, async (req, res) => {
  try {
    const contacts = whatsapp.getContacts();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar contatos do WhatsApp' });
  }
});


// --- ROUTES PARA TIPO AVARIA ---
app.get('/tipos-avaria', authMiddleware, async (req, res) => {
  const tipos = await prisma.tipoAvaria.findMany({ orderBy: { nome: 'asc' } });
  res.json(tipos);
});

app.post('/tipos-avaria', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    const tipo = await prisma.tipoAvaria.create({ data: { nome, descricao } });
    res.status(201).json(tipo);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao criar tipo de avaria' });
  }
});

app.put('/tipos-avaria/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    const tipo = await prisma.tipoAvaria.update({
      where: { id: req.params.id as string },
      data: { nome, descricao }
    });
    res.json(tipo);
  } catch (error) {
    res.status(400).json({ error: 'Erro ao atualizar tipo de avaria' });
  }
});

app.delete('/tipos-avaria/:id', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    await prisma.tipoAvaria.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Erro ao excluir tipo de avaria' });
  }
});

// --- ROUTES PARA EQUIPAMENTOS ---
app.post('/equipamentos', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    const { quantidade = 1, nome, categoriaId, tipoId, recebeuComDefeito, avariaId, fotoUrl, permitirEmprestimo } = req.body;
    
    if (recebeuComDefeito && quantidade > 1) {
      return res.status(400).json({ error: 'Não é possível cadastrar itens em lote com defeito. Cadastre individualmente se houver avaria inicial.' });
    }

    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    const tipo = await prisma.tipoEquipamento.findUnique({ where: { id: tipoId } });
    if (!categoria || !tipo) return res.status(400).json({ error: 'Categoria ou tipo inválido' });

    const prefixoCat = categoria.nome.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(3, 'X');
    const prefixoTipo = tipo.nome.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(3, 'X');

    const equipamentosCriados = [];

    for (let i = 0; i < quantidade; i++) {
      let codigoUnico = '';
      let existe = true;
      while (existe) {
        const num = Math.floor(1000 + Math.random() * 90000); // 4 ou 5 digitos
        codigoUnico = `${prefixoCat}-${prefixoTipo}-${num}`;
        const check = await prisma.equipamento.findUnique({ where: { codigoPatrimonio: codigoUnico } });
        if (!check) existe = false;
      }

      const equipamento = await prisma.equipamento.create({
        data: {
          codigoPatrimonio: codigoUnico,
          nome,
          categoriaId,
          tipoId,
          fotoUrl,
          recebeuComDefeito: recebeuComDefeito || false,
          permitirEmprestimo: permitirEmprestimo !== undefined ? permitirEmprestimo : true,
          statusCondicao: recebeuComDefeito ? "COM_DEFEITO" : "DISPONIVEL"
        }
      });

      if (recebeuComDefeito && avariaId) {
        await prisma.historicoAvaria.create({
          data: {
            equipamentoId: equipamento.id,
            tipoAvariaId: avariaId as string,
            descricao: "Defeito de fábrica ou inicial (cadastrado com o equipamento)",
            resolvido: false
          }
        });
      }
      equipamentosCriados.push(equipamento);
    }

    res.status(201).json(equipamentosCriados.length === 1 ? equipamentosCriados[0] : equipamentosCriados);
  } catch (error) {
    console.error('Erro ao criar equipamento:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Erro ao criar equipamento' });
  }
});

app.get('/equipamentos', authMiddleware, async (req: AuthRequest, res) => {
  const userRole = req.user?.role;
  let whereClause = {};

  if (userRole === 'SETOR') {
    whereClause = {
      categoria: {
        usuariosPermitidos: {
          some: { id: req.user?.id }
        }
      }
    };
  }

  const equipamentos = await prisma.equipamento.findMany({
    where: whereClause,
    include: {
      categoria: true,
      tipo: true,
      historicoAvarias: {
        where: { resolvido: false },
        include: { tipoAvaria: true }
      }
    },
    orderBy: { criadoEm: 'desc' }
  });
  res.json(equipamentos);
});

// PUT /equipamentos/:id
app.put('/equipamentos/:id', authMiddleware, authRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nome, categoriaId, tipoId, codigoPatrimonio, statusCondicao, avariaId, permitirEmprestimo } = req.body;

    const dataToUpdate: any = { nome };
    if (statusCondicao) dataToUpdate.statusCondicao = statusCondicao;
    if (categoriaId) dataToUpdate.categoriaId = categoriaId;
    if (tipoId) dataToUpdate.tipoId = tipoId;
    if (permitirEmprestimo !== undefined) dataToUpdate.permitirEmprestimo = permitirEmprestimo;

    // Se está adicionando uma nova avaria e o status estava DISPONIVEL, ajusta para COM_DEFEITO
    if (avariaId) {
      if (!dataToUpdate.statusCondicao || dataToUpdate.statusCondicao === 'DISPONIVEL') {
        dataToUpdate.statusCondicao = 'COM_DEFEITO';
      }
    } else if (dataToUpdate.statusCondicao === 'DISPONIVEL') {
      // Se administrador marcou o equipamento como DISPONÍVEL e não adicionou nova avaria, resolve as avarias abertas
      await prisma.historicoAvaria.updateMany({
        where: { equipamentoId: id as string, resolvido: false },
        data: { resolvido: true, dataResolucao: new Date() }
      });
    }

    if (codigoPatrimonio) {
      const eqExistente = await prisma.equipamento.findUnique({ where: { codigoPatrimonio } });
      if (eqExistente && eqExistente.id !== id) {
        return res.status(400).json({ error: 'Código de patrimônio já cadastrado por outro equipamento.' });
      }
      dataToUpdate.codigoPatrimonio = codigoPatrimonio;
    }

    const equipamento = await prisma.equipamento.update({
      where: { id: id as string },
      data: dataToUpdate,
      include: {
        categoria: true,
        tipo: true
      }
    });

    if (avariaId) {
      // Check if there is an unresolved avaria of this type
      const avariaAberta = await prisma.historicoAvaria.findFirst({
        where: { equipamentoId: id as string, resolvido: false, tipoAvariaId: avariaId as string }
      });
      if (!avariaAberta) {
        await prisma.historicoAvaria.create({
          data: {
            equipamentoId: id as string,
            tipoAvariaId: avariaId as string,
            descricao: "Avaria adicionada via edição do equipamento",
            resolvido: false
          }
        });
      }
    }

    res.json(equipamento);
  } catch (error) {
    console.error('Erro ao atualizar equipamento:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Erro ao atualizar equipamento' });
  }
});

app.delete('/equipamentos/:id', authMiddleware, authRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    const equipamento = await prisma.equipamento.findUnique({ where: { id } });
    if (!equipamento) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    
    // Deleta os históricos e itens relacionados antes de excluir o equipamento
    await prisma.historicoAvaria.deleteMany({ where: { equipamentoId: id as string } });
    await prisma.itemRequisicao.deleteMany({ where: { equipamentoId: id as string } });
    
    await prisma.equipamento.delete({
      where: { id: id as string }
    });
    
    res.json({ success: true, message: 'Equipamento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir equipamento:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Erro ao excluir equipamento' });
  }
});

app.get('/equipamentos/:codigo/info', async (req, res) => {
  const { codigo } = req.params;
  const equipamento = await prisma.equipamento.findUnique({
    where: { codigoPatrimonio: codigo },
    include: {
      itensRequisicao: {
        where: {
          requisicao: {
            status: { in: ['EMPRESTADO', 'AGUARDANDO_ACEITE'] }
          }
        },
        include: {
          requisicao: true
        }
      },
      historicoAvarias: {
        where: { resolvido: false },
        include: { tipoAvaria: true }
      }
    }
  });

  if (!equipamento) {
    return res.status(404).json({ error: 'Equipamento não encontrado' });
  }

  res.json(equipamento);
});

// --- ROUTES PARA REQUISIÇÕES ---
// --- ROUTES PARA REQUISIÇÕES E EVENTOS ---
app.post('/requisicoes', authMiddleware, authRole(['SETOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { 
      solicitanteNome, solicitanteEmail, solicitanteWhatsapp, departamento, 
      dataInicioEvento, dataFimEvento, dataRetiradaSugerida, 
      equipamentosIds, localId, horarioOrganizacao, materialNecessario,
      targetUserId
    } = req.body;

    let userId: string | null = req.user?.id || null;
    let fallbackReservaLocalUserId = req.user?.id || '';
    let finalNome = req.user?.nome || solicitanteNome;
    let finalEmail = req.user?.email || solicitanteEmail || null;
    let finalDepto = req.user?.departamento || departamento;
    let finalWhatsapp = solicitanteWhatsapp || null;

    if (req.user?.role === 'ADMIN' || req.user?.role === 'ESTOQUISTA') {
      if (targetUserId === 'EXTERNAL') {
        userId = null;
        finalNome = solicitanteNome; 
        finalDepto = departamento;
        finalWhatsapp = solicitanteWhatsapp || null;
      } else if (targetUserId) {
        userId = targetUserId;
        const targetUser = await prisma.usuario.findUnique({ where: { id: targetUserId }});
        if (targetUser) {
          finalNome = targetUser.nome;
          finalEmail = targetUser.email;
          finalDepto = targetUser.departamento || departamento;
          finalWhatsapp = targetUser.whatsapp || solicitanteWhatsapp || null;
        }
      }
    }

    // Se tiver localId, criar reserva de local também (ou apenas vincular)
    if (localId && (userId || fallbackReservaLocalUserId)) {
      const uIdReserva = userId || fallbackReservaLocalUserId;
      // Valida conflito de local
      const conflitos = await prisma.reservaLocal.findMany({
        where: {
          localId,
          status: { in: ['AGUARDANDO', 'CONFIRMADA'] },
          dataInicio: { lt: new Date(dataFimEvento) },
          dataFim: { gt: new Date(dataInicioEvento) }
        }
      });
      if (conflitos.length > 0) {
        return res.status(400).json({ error: 'Local selecionado não está mais disponível nestas datas' });
      }

      await prisma.reservaLocal.create({
        data: {
          localId,
          usuarioId: uIdReserva,
          dataInicio: new Date(dataInicioEvento),
          dataFim: new Date(dataFimEvento),
          status: 'AGUARDANDO' // Agora nasce como aguardando aprovação
        }
      });
    }

    const temEquipamento = equipamentosIds && equipamentosIds.length > 0;
    const temMaterial = materialNecessario && materialNecessario.trim().length > 0;

    if (!temEquipamento && !temMaterial) {
      if (localId && (userId || fallbackReservaLocalUserId)) {
        const uIdReserva = userId || fallbackReservaLocalUserId;
        const reserva = await prisma.reservaLocal.findFirst({
          where: { localId, usuarioId: uIdReserva, dataInicio: new Date(dataInicioEvento), dataFim: new Date(dataFimEvento) },
          include: { local: true }
        });

        const mensagemWhatsapp = `Olá, ${finalNome}! Recebemos sua solicitação de reserva para o espaço: ${reserva?.local?.nome}.\n\nSua reserva está pendente e aguardando aprovação pela administração.`;
        
        if (finalWhatsapp) {
          const num = finalWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
          await whatsapp.sendMessage(num, mensagemWhatsapp).catch(console.error);
        }
        
        return res.status(201).json({ isLocalOnly: true, reserva });
      } else {
        return res.status(400).json({ error: 'Nenhum equipamento, local ou material selecionado' });
      }
    }
    let hasWarning = false;
    let warningMessage = '';

    if (temEquipamento) {
      const start = new Date(dataInicioEvento);
      const end = new Date(dataFimEvento);
      
      const conflitoRequisicoes = await prisma.requisicao.findMany({
        where: {
          status: { notIn: ['CANCELADO', 'DEVOLVIDO', 'RECUSADO'] },
          itens: { some: { equipamentoId: { in: equipamentosIds } } },
          dataInicioEvento: { lt: end },
          dataFimEvento: { gt: start }
        }
      });

      if (conflitoRequisicoes.length > 0) {
        hasWarning = true;
        warningMessage = 'Atenção: Alguns equipamentos solicitados já possuem reserva neste horário. Sua solicitação ficará retida para análise do Administrador.';
      }
    }

    const requisicao = await prisma.requisicao.create({
      data: {
        solicitanteNome: finalNome, 
        solicitanteEmail: finalEmail, 
        solicitanteWhatsapp: finalWhatsapp, 
        departamento: finalDepto, 
        usuarioId: userId,
        dataInicioEvento: new Date(dataInicioEvento), 
        dataFimEvento: new Date(dataFimEvento), 
        dataRetiradaSugerida: dataRetiradaSugerida ? new Date(dataRetiradaSugerida) : new Date(dataInicioEvento),
        localId: localId || null,
        horarioOrganizacao: horarioOrganizacao ? new Date(horarioOrganizacao) : null,
        materialNecessario: materialNecessario || null,
        itens: {
          create: (equipamentosIds || []).map((id: string) => ({
            equipamento: { connect: { id } }
          }))
        }
      },
      include: { itens: { include: { equipamento: true } }, local: true }
    });

    const nomesEquipamentos = requisicao.itens.map(i => i.equipamento.nome).join('\n- ');
    const listaEquipamentos = nomesEquipamentos ? `\n- ${nomesEquipamentos}` : '';

    const baseMsgWpp = hasWarning ? `\n\n⚠️ ${warningMessage}` : `\n\nSua solicitação foi entregue, aguarde aprovação.`;
    const mensagemWhatsapp = `Olá, ${requisicao.solicitanteNome}! Recebemos sua solicitação com os seguintes itens:${listaEquipamentos}${baseMsgWpp}`;
    
    const baseMsgEmail = hasWarning ? `\n\n⚠️ ${warningMessage}\n\nAtenciosamente,\nEquipe Slave Estoque` : `\n\nSua solicitação foi entregue, aguarde aprovação.\n\nAtenciosamente,\nEquipe Slave Estoque`;
    const mensagemEmail = `Olá, ${requisicao.solicitanteNome}!\n\nRecebemos sua solicitação com os seguintes itens:${listaEquipamentos}${baseMsgEmail}`;

    if (requisicao.solicitanteWhatsapp) {
      const num = requisicao.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
      await whatsapp.sendMessage(num, mensagemWhatsapp);
    }
    
    if (requisicao.solicitanteEmail) {
      await sendEmail(requisicao.solicitanteEmail, 'Solicitação Recebida', mensagemEmail);
    }

    res.status(201).json({ 
      ...requisicao, 
      warning: hasWarning ? warningMessage : undefined 
    });
  } catch (error) {
    console.error('Erro ao criar requisição:', error);
    res.status(400).json({ error: 'Erro ao criar requisição' });
  }
});

app.get('/requisicoes', authMiddleware, async (req, res) => {
  const requisicoes = await prisma.requisicao.findMany({
    include: { itens: { include: { equipamento: true } }, local: true, usuario: { select: { corPersonalizada: true } } },
    orderBy: { criadoEm: 'desc' }
  });
  
  // Attach local status (we find the ReservaLocal for this local and user)
  const requisicoesComReserva = await Promise.all(requisicoes.map(async (r) => {
    let localStatus = null;
    if (r.localId && r.usuarioId) {
      const reserva = await prisma.reservaLocal.findFirst({
        where: { localId: r.localId, usuarioId: r.usuarioId, dataInicio: r.dataInicioEvento, dataFim: r.dataFimEvento }
      });
      if (reserva) localStatus = reserva.status;
    }
    return { ...r, localStatus };
  }));

  res.json(requisicoesComReserva);
});

app.post('/requisicoes/:id/cancelar', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    const requisicao = await prisma.requisicao.findUnique({ 
      where: { id },
      include: { itens: { include: { equipamento: true } } }
    });
    
    if (!requisicao) {
      return res.status(404).json({ error: 'Requisição não encontrada' });
    }

    if (req.user?.role === 'SETOR') {
      if (requisicao.usuarioId !== req.user?.id) {
        return res.status(403).json({ error: 'Você só pode cancelar suas próprias requisições.' });
      }
      if (!['PENDENTE', 'AGUARDANDO_SEPARACAO'].includes(requisicao.status)) {
        return res.status(400).json({ error: 'Não é possível cancelar uma requisição que já está em andamento.' });
      }
    } else {
      if (['DEVOLVIDO', 'CANCELADO', 'RECUSADO'].includes(requisicao.status)) {
        return res.status(400).json({ error: 'Esta requisição já foi finalizada ou cancelada.' });
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Cancelar a requisição
      await tx.requisicao.update({
        where: { id },
        data: { status: 'CANCELADO' }
      });

      // 2. Cancelar a reserva do local, se houver
      if (requisicao.localId && requisicao.usuarioId) {
        const reserva = await tx.reservaLocal.findFirst({
          where: {
            localId: requisicao.localId,
            usuarioId: requisicao.usuarioId,
            dataInicio: requisicao.dataInicioEvento,
            dataFim: requisicao.dataFimEvento,
            status: { in: ['AGUARDANDO', 'CONFIRMADA'] }
          }
        });
        if (reserva) {
          await tx.reservaLocal.update({
            where: { id: reserva.id },
            data: { status: 'CANCELADA' }
          });
        }
      }

      // 3. Devolver equipamentos para DISPONIVEL (caso já tivessem saído do estoque)
      for (const item of requisicao.itens) {
        if (item.equipamento.statusCondicao === 'RESERVADO' || item.equipamento.statusCondicao === 'EMPRESTADO') {
          await tx.equipamento.update({
            where: { id: item.equipamento.id },
            data: { statusCondicao: 'DISPONIVEL' }
          });
        }
      }
    });

    res.json({ success: true, message: 'Requisição cancelada com sucesso.' });
  } catch (error) {
    console.error('Erro ao cancelar:', error);
    res.status(500).json({ error: 'Erro interno ao cancelar requisição' });
  }
});

app.post('/requisicoes/:id/confirmar-local', authMiddleware, authRole(['ADMIN', 'ESTOQUISTA']), async (req, res) => {
  try {
    const id = req.params.id as string;
    
    const requisicao = await prisma.requisicao.findUnique({ 
      where: { id },
      include: { local: true, itens: true }
    });
    
    if (!requisicao || !requisicao.localId) {
      return res.status(404).json({ error: 'Requisição ou local não encontrado' });
    }

    // Achar a reserva de local correspondente (que está no mesmo horário)
    const reserva = requisicao.usuarioId ? await prisma.reservaLocal.findFirst({
      where: {
        localId: requisicao.localId,
        usuarioId: requisicao.usuarioId,
        status: 'AGUARDANDO'
      }
    }) : null;

    if (reserva) {
      await prisma.reservaLocal.update({
        where: { id: reserva.id },
        data: { status: 'CONFIRMADA' }
      });
    }

    const mensagemExtra = requisicao.itens.length > 0 ? " Se você solicitou equipamentos, eles já estão sendo preparados e você será avisado(a) quando estiverem prontos." : "";
    const mensagemWhatsapp = `✅ *Local Confirmado!*\n\nOlá, ${requisicao.solicitanteNome}. Sua solicitação para o espaço *${requisicao.local?.nome}* foi confirmada!${mensagemExtra}`;

    if (requisicao.solicitanteWhatsapp) {
      const num = requisicao.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
      await whatsapp.sendMessage(num, mensagemWhatsapp);
    }

    res.json({ success: true, message: 'Local confirmado com sucesso!' });
  } catch (error) {
    console.error('Erro ao confirmar local:', error);
    res.status(500).json({ error: 'Erro interno ao confirmar local' });
  }
});

app.post('/requisicoes/:id/receber', authMiddleware, authRole(['SETOR']), async (req, res) => {
  try {
    const id = req.params.id as string;
    
    const reqDb = await prisma.requisicao.findUnique({ where: { id }, include: { itens: true } });
    if (!reqDb) return res.status(404).json({ error: 'Requisição não encontrada' });
    
    if (!['AGUARDANDO_ACEITE', 'AGUARDANDO_DEVOLUCAO', 'EM_SEPARACAO', 'EMPRESTADO'].includes(reqDb.status)) {
      return res.status(400).json({ error: 'Status atual não permite recebimento.' });
    }

    // Atualiza status da requisição
    const updatedReq = await prisma.requisicao.update({
      where: { id },
      data: { status: 'EMPRESTADO' }
    });

    res.json({ success: true, requisicao: updatedReq, message: 'Recebimento confirmado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao confirmar recebimento', details: error });
  }
});

app.post('/requisicoes/:id/entregar-manualmente', authMiddleware, authRole(['ESTOQUISTA', 'ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    
    const reqDb = await prisma.requisicao.findUnique({ where: { id }, include: { itens: true } });
    if (!reqDb) return res.status(404).json({ error: 'Requisição não encontrada' });
    
    if (!['PENDENTE', 'AGUARDANDO_SEPARACAO', 'EM_SEPARACAO'].includes(reqDb.status)) {
      return res.status(400).json({ error: 'Status atual não permite entrega manual.' });
    }

    // Marca todos os itens como separados
    await prisma.itemRequisicao.updateMany({
      where: { requisicaoId: id },
      data: { statusSeparacao: true }
    });

    // Atualiza status do equipamento
    for (const item of reqDb.itens) {
      if (item.equipamentoId) {
        await prisma.equipamento.update({
          where: { id: item.equipamentoId },
          data: { statusCondicao: 'EMPRESTADO', quantidadeUso: { increment: 1 } }
        });
      }
    }

    // Atualiza status da requisição
    const updatedReq = await prisma.requisicao.update({
      where: { id },
      data: { status: 'EMPRESTADO' }
    });

    if (reqDb.solicitanteWhatsapp) {
      const num = reqDb.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
      const nomesEquipamentos = reqDb.itens.map((i: any) => i.equipamento?.nome).filter(Boolean).join('\n- ');
      const msg = `📦 *Sua requisição de equipamentos acaba de ser entregue!*\n\nOlá, ${reqDb.solicitanteNome}. Os seguintes itens foram entregues para você:\n- ${nomesEquipamentos}\n\nPor favor, cuide bem dos aparelhos e bom evento!`;
      whatsapp.sendMessage(num, msg).catch(console.error);
    }

    res.json({ success: true, requisicao: updatedReq, message: 'Entregue com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao entregar', details: error });
  }
});

app.post('/requisicoes/:id/separar', authMiddleware, authRole(['ESTOQUISTA', 'ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { codigoPatrimonio } = req.body;

    const equipamento = await prisma.equipamento.findUnique({ where: { codigoPatrimonio } });
    if (!equipamento) return res.status(404).json({ error: 'Equipamento não encontrado' });

    if (equipamento.statusCondicao === 'COM_DEFEITO') {
      return res.status(400).json({ error: 'Equipamento não pode sair pois está com defeito.' });
    }
    
    let item = await prisma.itemRequisicao.findFirst({
      where: { requisicaoId: id, equipamentoId: equipamento.id }
    });

    let isExtra = false;
    let itemAtualizado;
    if (!item) {
      // Tenta encontrar um item na requisição que seja do MESMO MODELO e ainda NÃO SEPARADO
      const itemDoMesmoModelo = await prisma.itemRequisicao.findFirst({
        where: {
          requisicaoId: id,
          statusSeparacao: false,
          equipamento: {
            nome: equipamento.nome,
            tipoId: equipamento.tipoId
          }
        }
      });

      if (itemDoMesmoModelo) {
        // SWAP inteligente! Troca o aparelho reservado por este que o conferente acabou de bipar
        itemAtualizado = await prisma.itemRequisicao.update({
          where: { id: itemDoMesmoModelo.id },
          data: { 
            equipamentoId: equipamento.id,
            statusSeparacao: true 
          }
        });
        item = itemAtualizado;
      } else {
        // Não achou do mesmo modelo, ou todos já foram bipados. Adiciona como extra (ou pode bloquear caso desejado)
        itemAtualizado = await prisma.itemRequisicao.create({
          data: {
            requisicaoId: id,
            equipamentoId: equipamento.id,
            statusSeparacao: true
          }
        });
        item = itemAtualizado;
        isExtra = true;
      }
    } else {
      itemAtualizado = await prisma.itemRequisicao.update({
        where: { id: item.id },
        data: { statusSeparacao: true }
      });
    }

    const reqDb = await prisma.requisicao.findUnique({ where: { id }, include: { itens: true } });
    if (reqDb?.status === "PENDENTE") {
      await prisma.requisicao.update({ where: { id }, data: { status: "EM_SEPARACAO" } });
    }

    const todosSeparados = reqDb?.itens.every(i => i.id === itemAtualizado.id ? true : i.statusSeparacao);
    
    if (todosSeparados && reqDb?.status === "EM_SEPARACAO") {
      await prisma.requisicao.update({ 
        where: { id }, 
        data: { status: "AGUARDANDO_DEVOLUCAO" } 
      });
      
      const itensReq = await prisma.itemRequisicao.findMany({ where: { requisicaoId: id }, include: { equipamento: true } });
      const nomesEquipamentos = itensReq.map(i => i.equipamento.nome).join('\n- ');

      if (reqDb?.solicitanteWhatsapp) {
        const num = reqDb.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
        const msg = `📦 *Sua requisição de equipamentos acaba de ser entregue!*\n\nOlá, ${reqDb.solicitanteNome}. Os seguintes itens foram separados/entregues para você:\n- ${nomesEquipamentos}\n\nPor favor, cuide bem dos aparelhos!`;
        await whatsapp.sendMessage(num, msg);
      }
      
      if (reqDb?.solicitanteEmail) {
        await sendEmail(reqDb.solicitanteEmail, 'Equipamentos Prontos para Retirada', `Olá, ${reqDb.solicitanteNome}!\n\nOs equipamentos solicitados já foram separados e entregues.\n\nAtenciosamente,\nEquipe Slave Estoque`);
      }
    }

    res.json({ success: true, item: itemAtualizado, message: isExtra ? `Item extra '${equipamento.nome}' adicionado e separado!` : `Item '${equipamento.nome}' separado!` });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno', details: error });
  }
});

app.get('/requisicoes/aceite/:token', async (req, res) => {
  const reqDb = await prisma.requisicao.findUnique({
    where: { tokenAceite: req.params.token },
    include: { itens: { include: { equipamento: true } } }
  });
  if (!reqDb) return res.status(404).json({ error: 'Token inválido ou expirado' });
  res.json(reqDb);
});

app.post('/requisicoes/aceite/:token', async (req, res) => {
  const reqDb = await prisma.requisicao.findUnique({
    where: { tokenAceite: req.params.token },
    include: { itens: true }
  });
  if (!reqDb) return res.status(404).json({ error: 'Token inválido' });
  if (reqDb.status !== 'AGUARDANDO_ACEITE') return res.status(400).json({ error: 'Requisição não está aguardando aceite' });

  await prisma.requisicao.update({
    where: { id: reqDb.id },
    data: { status: 'EMPRESTADO' }
  });

  for (const item of reqDb.itens) {
    await prisma.equipamento.update({
      where: { id: item.equipamentoId },
      data: { statusCondicao: 'EMPRESTADO', quantidadeUso: { increment: 1 } }
    });
  }

  res.json({ success: true, message: 'Empréstimo liberado com sucesso!' });
});

app.post('/requisicoes/:id/devolver', authMiddleware, authRole(['ESTOQUISTA', 'ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { codigoPatrimonio, avaria, descricaoAvaria } = req.body;

    const equipamento = await prisma.equipamento.findUnique({ where: { codigoPatrimonio } });
    if (!equipamento) return res.status(404).json({ error: 'Equipamento não encontrado' });
    
    const item = await prisma.itemRequisicao.findFirst({
      where: { requisicaoId: id, equipamentoId: equipamento.id }
    });

    if (!item) return res.status(400).json({ error: 'Equipamento não pertence a esta requisição' });
    if (!item.statusSeparacao) return res.status(400).json({ error: 'Equipamento não havia sido separado/entregue' });

    const itemAtualizado = await prisma.itemRequisicao.update({
      where: { id: item.id },
      data: { statusDevolucao: true }
    });

    // Atualiza status do equipamento para disponível novamente ou com defeito
    await prisma.equipamento.update({
      where: { id: equipamento.id },
      data: { statusCondicao: avaria ? 'COM_DEFEITO' : 'DISPONIVEL' }
    });

    if (avaria) {
      await prisma.historicoAvaria.create({
        data: {
          equipamentoId: equipamento.id,
          requisicaoId: id,
          tipoAvariaId: req.body.tipoAvariaId || null,
          descricao: descricaoAvaria || 'Avaria reportada durante devolução.',
          resolvido: false
        }
      });
    }

      const reqDb = await prisma.requisicao.findUnique({ where: { id }, include: { itens: true } });
      
      const itensSeparados = reqDb?.itens.filter(i => i.statusSeparacao) || [];
      const todosDevolvidos = itensSeparados.length > 0 && itensSeparados.every(i => i.id === item.id ? true : i.statusDevolucao);
      
      if (todosDevolvidos) {
        await prisma.requisicao.update({ where: { id }, data: { status: "DEVOLVIDO" } });
        
        const countAvarias = await prisma.historicoAvaria.count({ where: { requisicaoId: id } });
        const observacaoAvaria = (countAvarias > 0 || avaria) ? " Observamos que houve relato de avaria, defeito ou pendência em algum(ns) dos itens devolvidos." : "";

        if (reqDb?.solicitanteWhatsapp) {
          const num = reqDb.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
          const msg = `Olá, ${reqDb.solicitanteNome}! Recebemos os equipamentos de volta.${observacaoAvaria} Agradecemos pelo cuidado e até a próxima!`;
          await whatsapp.sendMessage(num, msg);
        }
        
        if (reqDb?.solicitanteEmail) {
          await sendEmail(reqDb.solicitanteEmail, 'Equipamentos Devolvidos com Sucesso', `Olá, ${reqDb.solicitanteNome}!\n\nConfirmamos o recebimento e devolução dos equipamentos solicitados.${observacaoAvaria ? '\n' + observacaoAvaria : ''}\n\nAgradecemos pelo cuidado e até a próxima!\n\nAtenciosamente,\nEquipe Slave Estoque`);
        }
      }

    res.json(itemAtualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao devolver', details: error });
  }
});

app.post('/requisicoes/:id/finalizar-devolucao', authMiddleware, authRole(['ESTOQUISTA', 'ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { itensProcessados } = req.body;
    // itensProcessados: { codigoPatrimonio: string, devolvido: boolean, avaria: boolean, descricaoAvaria?: string, tipoAvariaId?: string }[]

    for (const itemProc of (itensProcessados || [])) {
      const equip = await prisma.equipamento.findUnique({ where: { codigoPatrimonio: itemProc.codigoPatrimonio } });
      if (!equip) continue;

      const item = await prisma.itemRequisicao.findFirst({
        where: { requisicaoId: id, equipamentoId: equip.id }
      });
      if (!item) continue;

      if (itemProc.devolvido) {
        // Devolvido normal ou com avaria
        await prisma.itemRequisicao.update({
          where: { id: item.id },
          data: { statusDevolucao: true }
        });
        await prisma.equipamento.update({
          where: { id: equip.id },
          data: { statusCondicao: itemProc.avaria ? 'COM_DEFEITO' : 'DISPONIVEL' }
        });

        if (itemProc.avaria) {
          await prisma.historicoAvaria.create({
            data: {
              equipamentoId: equip.id,
              requisicaoId: id,
              tipoAvariaId: itemProc.tipoAvariaId || null,
              descricao: itemProc.descricaoAvaria || 'Avaria registrada na devolução.',
              resolvido: false
            }
          });
        }
      } else {
        // Faltante!
        await prisma.itemRequisicao.update({
          where: { id: item.id },
          data: { statusDevolucao: true, observacao: `FALTANTE: ${itemProc.descricaoAvaria || 'Não devolvido'}` }
        });
        await prisma.equipamento.update({
          where: { id: equip.id },
          data: { statusCondicao: 'COM_DEFEITO' } // Tratar como defeito para não ser emprestado
        });
        await prisma.historicoAvaria.create({
          data: {
            equipamentoId: equip.id,
            requisicaoId: id,
            descricao: `ITEM FALTANTE NA DEVOLUÇÃO: ${itemProc.descricaoAvaria || 'Não devolvido'}`,
            resolvido: false
          }
        });
      }
    }

    // Finalizar a requisição
    const reqDb = await prisma.requisicao.findUnique({ where: { id } });
    if (reqDb) {
      await prisma.requisicao.update({ where: { id }, data: { status: "DEVOLVIDO" } });
      // Podemos enviar mensagem de whatsapp geral aqui, se desejado.
    }

    res.json({ success: true, message: 'Devolução finalizada em lote com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao finalizar devolução em lote', details: error });
  }
});

app.post('/requisicoes/:id/devolver-manualmente', authMiddleware, authRole(['ESTOQUISTA', 'ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    
    const reqDb = await prisma.requisicao.findUnique({ where: { id }, include: { itens: true } });
    if (!reqDb) return res.status(404).json({ error: 'Requisição não encontrada' });
    
    if (reqDb.status !== 'EMPRESTADO') {
      return res.status(400).json({ error: 'Apenas requisições com status EMPRESTADO podem ser devolvidas.' });
    }

    // Atualiza todos os itens para devolvido e disponíveis
    for (const item of reqDb.itens) {
      if (!item.statusDevolucao) {
        await prisma.itemRequisicao.update({
          where: { id: item.id },
          data: { statusDevolucao: true }
        });
        
        if (item.equipamentoId) {
          await prisma.equipamento.update({
            where: { id: item.equipamentoId },
            data: { statusCondicao: 'DISPONIVEL' }
          });
        }
      }
    }

    // Finalizar a requisição
    const updatedReq = await prisma.requisicao.update({ where: { id }, data: { status: "DEVOLVIDO" } });

    if (reqDb.solicitanteWhatsapp) {
      const num = reqDb.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
      const nomesEquipamentos = reqDb.itens.map((i: any) => i.equipamento?.nome).filter(Boolean).join('\n- ');
      const msg = `✅ *Devolução concluída!*\n\nOlá, ${reqDb.solicitanteNome}. Os seguintes itens foram devolvidos ao estoque com sucesso:\n- ${nomesEquipamentos}\n\nObrigado!`;
      whatsapp.sendMessage(num, msg).catch(console.error);
    }

    res.json({ success: true, requisicao: updatedReq, message: 'Materiais recebidos com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar recebimento manual', details: error });
  }
});

app.get('/equipamentos/:codigo/requisicao-ativa', authMiddleware, async (req, res) => {
  try {
    const codigo = String(req.params.codigo);
    const item = await prisma.itemRequisicao.findFirst({
      where: {
        equipamento: { codigoPatrimonio: codigo },
        statusSeparacao: true,
        statusDevolucao: false,
        requisicao: {
          status: { in: ['EMPRESTADO', 'AGUARDANDO_ACEITE', 'AGUARDANDO_DEVOLUCAO', 'EM_SEPARACAO'] }
        }
      },
      include: { requisicao: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Nenhuma requisição ativa encontrada para este equipamento' });
    }
    res.json({ requisicaoId: item.requisicaoId, requisicao: (item as any).requisicao });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.get('/dashboard/metrics', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
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

    const totalRequisicoes = await prisma.requisicao.count();
    
    // Group by departamento para ver quem mais pede
    const reqsPorDepto = await prisma.requisicao.groupBy({
      by: ['departamento'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const pendingReturns = await prisma.requisicao.findMany({
      where: {
        status: { in: ['EMPRESTADO', 'AGUARDANDO_ACEITE'] }
      },
      include: {
        usuario: true,
        itens: {
          include: { equipamento: true }
        }
      },
      orderBy: { dataFimEvento: 'asc' }
    });

    res.json({
      totalEquipamentos,
      equipamentosComDefeito,
      equipamentosEmprestados,
      equipamentosDisponiveis,
      totalRequisicoes,
      topDepartamentos: reqsPorDepto.map(r => ({ name: r.departamento, count: r._count.id })),
      pendingReturns
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar métricas', details: error });
  }
});

app.delete('/database/limpar-pedidos', authMiddleware, authRole(['ADMIN']), async (req, res) => {
  try {
    // Apaga históricos de avaria ligados a requisições
    await prisma.historicoAvaria.deleteMany({
      where: { requisicaoId: { not: null } }
    });
    
    // Apaga itens de requisição
    await prisma.itemRequisicao.deleteMany({});
    
    // Apaga todas as requisições
    await prisma.requisicao.deleteMany({});
    
    // Apaga reservas locais (do calendário)
    await prisma.reservaLocal.deleteMany({});

    // Volta todos os equipamentos para DISPONIVEL, exceto os com defeito/manutenção
    await prisma.equipamento.updateMany({
      where: { statusCondicao: { notIn: ['COM_DEFEITO', 'EM_MANUTENCAO'] } },
      data: { statusCondicao: 'DISPONIVEL' }
    });

    res.json({ success: true, message: 'Todos os pedidos e reservas foram zerados com sucesso!' });
  } catch (error) {
    console.error('Erro ao limpar pedidos:', error);
    res.status(500).json({ error: 'Erro ao limpar banco de dados', details: error });
  }
});

// --- ROTINA DE LEMBRETE DE DEVOLUÇÃO NO WHATSAPP (A CADA 1 MIN) ---
setInterval(async () => {
  try {
    const agora = new Date();
    // Procurar por requisições cujo término seja daqui a 5 minutos (margem de 1 minuto)
    const alvoInicio = new Date(agora.getTime() + 4 * 60 * 1000 + 30 * 1000); // 4m30s
    const alvoFim = new Date(agora.getTime() + 5 * 60 * 1000 + 30 * 1000); // 5m30s

    const requisicoesParaLembrar = await prisma.requisicao.findMany({
      where: {
        status: 'EMPRESTADO',
        lembreteDevolucaoEnviado: false,
        dataFimEvento: {
          gte: alvoInicio,
          lte: alvoFim
        }
      },
      include: {
        itens: {
          include: {
            equipamento: true
          }
        }
      }
    });

    for (const req of requisicoesParaLembrar) {
      if (!req.solicitanteWhatsapp) continue;

      let msgEquipamentos = '';
      
      for (const item of req.itens) {
        // Encontra o próximo uso DESTE equipamento ESPECÍFICO depois do término da atual
        const proximoUso = await prisma.itemRequisicao.findFirst({
          where: {
            equipamentoId: item.equipamento.id,
            requisicao: {
              status: { in: ['APROVADA', 'AGUARDANDO_SEPARACAO', 'PENDENTE'] },
              dataInicioEvento: {
                gte: req.dataFimEvento
              }
            }
          },
          include: {
            requisicao: true
          },
          orderBy: {
            requisicao: {
              dataInicioEvento: 'asc'
            }
          }
        });

        if (proximoUso) {
          const proximoNome = proximoUso.requisicao.solicitanteNome;
          const proximaHora = proximoUso.requisicao.dataInicioEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          msgEquipamentos += `- ${item.equipamento.nome}: A próxima a usar será ${proximoNome} às ${proximaHora}\n`;
        } else {
          msgEquipamentos += `- ${item.equipamento.nome}: Livre, sem uso previsto para logo depois.\n`;
        }
      }

      const num = req.solicitanteWhatsapp.replace(/\D/g, '') + '@s.whatsapp.net';
      const msg = `⏳ *Lembrete de Devolução* ⏳\nOlá ${req.solicitanteNome}, faltam 5 minutos para acabar o seu tempo de uso dos seguintes equipamentos:\n\n${msgEquipamentos}\nSe o seu uso for se estender, por favor nos avise agora respondendo esta mensagem!`;

      await whatsapp.sendMessage(num, msg);

      // Marca como enviado para não repetir
      await prisma.requisicao.update({
        where: { id: req.id },
        data: { lembreteDevolucaoEnviado: true }
      });
    }
  } catch (error) {
    console.error('[CRON] Erro ao processar lembretes de devolução:', error);
  }
}, 60000);

const PORT = process.env.PORT || 3333;

async function bootstrap() {
  try {
    const adminCount = await prisma.usuario.count({ where: { role: 'ADMIN' } });
    if (adminCount === 0) {
      const bcrypt = require('bcryptjs');
      const senhaHash = await bcrypt.hash('123', 10);
      await prisma.usuario.create({
        data: {
          nome: 'Administrador (Primeiro Acesso)',
          email: 'admin@admin.com',
          senhaHash: senhaHash,
          role: 'ADMIN',
          departamento: 'TI'
        }
      });
      console.log('[BOOTSTRAP] Usuário admin@admin.com criado para primeiro acesso.');
    }
  } catch (error) {
    console.error('[BOOTSTRAP] Erro ao criar usuário admin padrão:', error);
  }

  app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    whatsapp.connect();
  });
}

bootstrap();

