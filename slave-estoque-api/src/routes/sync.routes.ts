import { Router } from 'express';
import { prisma } from '../prisma';
import CryptoJS from 'crypto-js';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { whatsapp } from '../whatsapp';

const router = Router();

// A mesma chave deve ser usada no App Mobile
const SECRET_KEY = process.env.SYNC_SECRET_KEY || 'minha-chave-secreta-estoque-123';

function getLocalIpAddresses(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Ignora endereços de link-local (169.254.x.x) a menos que não haja outro
        if (!iface.address.startsWith('169.254.')) {
          ips.push(iface.address);
        }
      }
    }
  }

  if (ips.length === 0) {
    // Se não encontrou nenhum IP externo, tenta pegar qualquer não-interno
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  }

  if (ips.length === 0) return ['127.0.0.1'];

  // Ordena os IPs para que redes locais mais comuns apareçam primeiro (192.168.x, 10.x, 172.16-31.x)
  ips.sort((a, b) => {
    const isLocalClassA = a.startsWith('10.');
    const isLocalClassC = a.startsWith('192.168.');
    const isLocalClassB = a.startsWith('172.') && (() => {
      const secondOctet = parseInt(a.split('.')[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    })();

    const isALocal = isLocalClassC || isLocalClassA || isLocalClassB;

    const bLocalClassA = b.startsWith('10.');
    const bLocalClassC = b.startsWith('192.168.');
    const bLocalClassB = b.startsWith('172.') && (() => {
      const secondOctet = parseInt(b.split('.')[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    })();

    const isBLocal = bLocalClassC || bLocalClassA || bLocalClassB;

    if (isALocal && !isBLocal) return -1;
    if (!isALocal && isBLocal) return 1;
    return 0;
  });

  return Array.from(new Set(ips));
}

// 1. Gera o Payload Criptografado para o QR Code
router.get('/qr-payload', (req, res) => {
  const ips = getLocalIpAddresses();
  const port = Number(process.env.PORT) || 3333;
  const payload = JSON.stringify({ ips, port });
  
  const encrypted = CryptoJS.AES.encrypt(payload, SECRET_KEY).toString();
  
  res.json({ encryptedPayload: encrypted, ips, port });
});

// 2. Rota de PING (Para Discovery Local via HTTP / Handshake do QR Code)
router.get('/ping', (req, res) => {
  res.json({ 
    service: 'slave-estoque-server', 
    version: '1.0', 
    timestamp: new Date().toISOString() 
  });
});

// 3. Rota de PULL (Mobile baixa dados)
router.get('/pull', async (req, res) => {
  try {
    const [
      equipamentos,
      categorias,
      tipos,
      requisicoes,
      tiposAvaria,
      historicoAvarias,
      usuarios
    ] = await Promise.all([
      prisma.equipamento.findMany(),
      prisma.categoria.findMany(),
      prisma.tipoEquipamento.findMany(),
      prisma.requisicao.findMany({
        where: {
          status: { in: ['PENDENTE', 'AGUARDANDO_SEPARACAO', 'EM_SEPARACAO', 'AGUARDANDO_DEVOLUCAO', 'AGUARDANDO_ACEITE', 'EMPRESTADO'] }
        }
      }),
      prisma.tipoAvaria.findMany(),
      prisma.historicoAvaria.findMany({
        include: {
          tipoAvaria: true
        }
      }),
      prisma.usuario.findMany({
        select: { id: true, nome: true, departamento: true, whatsapp: true }
      })
    ]);

    const itensRequisicao = await prisma.itemRequisicao.findMany({
      where: {
        requisicaoId: { in: requisicoes.map(r => r.id) }
      }
    });

    res.json({
      equipamentos,
      categorias,
      tipos,
      requisicoes,
      itensRequisicao,
      tiposAvaria,
      historicoAvarias,
      usuarios
    });
  } catch (error) {
    console.error('Erro no PULL:', error);
    res.status(500).json({ error: 'Erro ao gerar dados de pull' });
  }
});

// 4. Rota de PUSH (Mobile envia dados sincronizados)
router.post('/push', async (req, res) => {
  try {
    const { acoes } = req.body;
    
    const logs: string[] = [];
    const reqsAtualizadas: Record<string, string[]> = {};
    const reqsDevolvidas: Record<string, string[]> = {};

    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

    for (const acao of acoes || []) {
      try {
        if (acao.tipo === 'NOVA_REQUISICAO_AVULSA') {
          const { requisicaoId, solicitanteNome, departamento, whatsapp: reqWhatsapp, usuarioId } = acao.dados || {};
          if (requisicaoId) {
            const exists = await prisma.requisicao.findUnique({ where: { id: requisicaoId } });
            if (!exists) {
              await prisma.requisicao.create({
                data: {
                  id: requisicaoId,
                  solicitanteNome: solicitanteNome || 'Desconhecido',
                  departamento: departamento || 'N/D',
                  solicitanteWhatsapp: reqWhatsapp || null,
                  usuarioId: usuarioId || null,
                  status: 'AGUARDANDO_DEVOLUCAO',
                  dataInicioEvento: new Date(),
                  dataFimEvento: new Date(),
                  dataRetiradaSugerida: new Date()
                }
              });
              logs.push(`Requisição Avulsa ${requisicaoId} criada.`);
            }
          }
          continue;
        }

        if (acao.tipo === 'SEPARACAO') {
          let itemDb = null;
          if (acao.itemId && !acao.itemId.startsWith('offline-')) {
            itemDb = await prisma.itemRequisicao.findUnique({ 
              where: { id: acao.itemId },
              include: { equipamento: true }
            });
          }

          let equipName = '';
          let reqId = null;

          if (!itemDb && acao.dados && acao.dados.requisicaoId && acao.dados.equipamentoId) {
            const eqInfo = await prisma.equipamento.findUnique({ where: { id: acao.dados.equipamentoId } });
            equipName = eqInfo ? eqInfo.nome : 'Equipamento';
            reqId = acao.dados.requisicaoId;

            if (reqId !== 'req-offline') {
              // Garante que a requisição exista
              const reqExists = await prisma.requisicao.findUnique({ where: { id: reqId } });
              if (!reqExists) {
                await prisma.requisicao.create({
                  data: {
                    id: reqId,
                    solicitanteNome: 'Solicitante Offline',
                    departamento: 'Geral',
                    status: 'AGUARDANDO_DEVOLUCAO',
                    dataInicioEvento: new Date(),
                    dataFimEvento: new Date(),
                    dataRetiradaSugerida: new Date()
                  }
                });
              }

              // Evita duplicação de ID
              const existingItem = await prisma.itemRequisicao.findUnique({ where: { id: acao.itemId } });
              if (existingItem) {
                itemDb = await prisma.itemRequisicao.update({
                  where: { id: acao.itemId },
                  data: { statusSeparacao: true },
                  include: { equipamento: true }
                });
              } else {
                itemDb = await prisma.itemRequisicao.create({
                  data: {
                    id: acao.itemId,
                    requisicaoId: reqId,
                    equipamentoId: acao.dados.equipamentoId,
                    statusSeparacao: true,
                  },
                  include: { equipamento: true }
                });
              }
              logs.push(`Item ${acao.itemId}: Separado com sucesso.`);
              
              await prisma.equipamento.update({
                where: { id: acao.dados.equipamentoId },
                data: { statusCondicao: 'EMPRESTADO' }
              }).catch(e => console.warn('Erro ao atualizar status do equipamento:', e));

              if (!reqsAtualizadas[reqId]) reqsAtualizadas[reqId] = [];
              reqsAtualizadas[reqId].push(equipName);
            } else {
              await prisma.equipamento.update({
                where: { id: acao.dados.equipamentoId },
                data: { statusCondicao: 'EMPRESTADO' }
              }).catch(e => console.warn('Erro ao atualizar status do equipamento:', e));
              logs.push(`Equipamento ${acao.dados.equipamentoId}: Liberado avulso.`);
            }
          } else if (itemDb) {
            reqId = itemDb.requisicaoId;
            equipName = itemDb.equipamento?.nome || 'Equipamento';

            if (itemDb.statusSeparacao) {
              await prisma.itemRequisicao.update({
                where: { id: acao.itemId },
                data: {
                  observacao: `BAIXA DUPLA: Tentativa de separação pelo app offline em ${acao.data}`
                }
              });
              logs.push(`Item ${acao.itemId}: Baixa Dupla (Separação) registrada.`);
            } else {
              await prisma.itemRequisicao.update({
                where: { id: acao.itemId },
                data: { statusSeparacao: true }
              });
              await prisma.equipamento.update({
                where: { id: itemDb.equipamentoId },
                data: { statusCondicao: 'EMPRESTADO' }
              }).catch(e => console.warn('Erro ao atualizar equipamento:', e));

              logs.push(`Item ${acao.itemId}: Separado com sucesso.`);
              if (reqId) {
                if (!reqsAtualizadas[reqId]) reqsAtualizadas[reqId] = [];
                reqsAtualizadas[reqId].push(equipName);
              }
            }
          }
        }

        if (acao.tipo === 'DEVOLUCAO') {
          let itemDb = null;
          if (acao.itemId) {
            itemDb = await prisma.itemRequisicao.findUnique({ where: { id: acao.itemId } });
          }

          const equipId = itemDb ? itemDb.equipamentoId : (acao.dados ? acao.dados.equipamentoId : null);

          if (itemDb) {
            if (itemDb.statusDevolucao) {
              await prisma.itemRequisicao.update({
                where: { id: acao.itemId },
                data: {
                  observacao: `BAIXA DUPLA: Tentativa de devolução pelo app offline em ${acao.data}`
                }
              });
              logs.push(`Item ${acao.itemId}: Baixa Dupla (Devolução) registrada.`);
            } else {
              await prisma.itemRequisicao.update({
                where: { id: acao.itemId },
                data: { statusDevolucao: true }
              });
              logs.push(`Item ${acao.itemId}: Devolvido com sucesso.`);
            }
          }

          if (equipId) {
            const temAvaria = acao.dados && acao.dados.avaria;
            
            await prisma.equipamento.update({
              where: { id: equipId },
              data: { statusCondicao: temAvaria ? 'COM_DEFEITO' : 'DISPONIVEL' }
            }).catch(e => console.warn('Erro ao atualizar status do equipamento na devolução:', e));
            
            if (temAvaria) {
              await prisma.historicoAvaria.create({
                data: {
                  equipamentoId: equipId,
                  requisicaoId: (itemDb && itemDb.requisicaoId !== 'req-offline') ? itemDb.requisicaoId : undefined,
                  descricao: acao.dados.avariaDescricao || "Defeito reportado no app offline",
                  resolvido: false
                }
              }).catch(e => console.warn('Erro ao criar registro de avaria:', e));
            }
            
            if (itemDb && itemDb.requisicaoId && itemDb.requisicaoId !== 'req-offline') {
              if (!reqsDevolvidas[itemDb.requisicaoId]) reqsDevolvidas[itemDb.requisicaoId] = [];
              const equip = await prisma.equipamento.findUnique({ where: { id: equipId } });
              if (equip) reqsDevolvidas[itemDb.requisicaoId].push(equip.nome);
            }
          }
        }
        
        if (acao.tipo === 'NOVO_EQUIPAMENTO') {
          let categoriaId = acao.dados.categoriaId;
          let tipoId = acao.dados.tipoId;

          let catExists = false;
          if (categoriaId) {
            const cat = await prisma.categoria.findUnique({ where: { id: categoriaId } });
            if (cat) catExists = true;
          }

          let tipoExists = false;
          if (tipoId) {
            const tipo = await prisma.tipoEquipamento.findUnique({ where: { id: tipoId } });
            if (tipo) tipoExists = true;
          }

          if (!catExists || !tipoExists) {
            let defaultCat = await prisma.categoria.findUnique({ where: { nome: 'Sem Categoria' } });
            if (!defaultCat) {
              defaultCat = await prisma.categoria.create({
                data: { nome: 'Sem Categoria' }
              });
            }
            categoriaId = defaultCat.id;

            let defaultTipo = await prisma.tipoEquipamento.findFirst({
              where: { nome: 'Geral', categoriaId: defaultCat.id }
            });
            if (!defaultTipo) {
              defaultTipo = await prisma.tipoEquipamento.create({
                data: { nome: 'Geral', categoriaId: defaultCat.id }
              });
            }
            tipoId = defaultTipo.id;
          }

          const recebeuComDefeito = acao.dados.recebeuComDefeito || false;
          const statusCondicao = recebeuComDefeito ? "COM_DEFEITO" : (acao.dados.statusCondicao || 'DISPONIVEL');
          const fotoDefinitiva = acao.dados.fotoUrl || null;

          // Upsert para nunca falhar se for reenviado ou duplicado
          const existingEquip = await prisma.equipamento.findFirst({
            where: {
              OR: [
                { id: acao.dados.id },
                { codigoPatrimonio: acao.dados.codigoPatrimonio }
              ]
            }
          });

          if (existingEquip) {
            await prisma.equipamento.update({
              where: { id: existingEquip.id },
              data: {
                nome: acao.dados.nome,
                categoriaId: categoriaId,
                tipoId: tipoId,
                statusCondicao: statusCondicao,
                recebeuComDefeito: recebeuComDefeito,
                permitirEmprestimo: acao.dados.permitirEmprestimo !== undefined ? acao.dados.permitirEmprestimo : true,
                fotoUrl: fotoDefinitiva || existingEquip.fotoUrl
              }
            });
            logs.push(`Equipamento ${acao.dados.codigoPatrimonio} atualizado.`);
          } else {
            await prisma.equipamento.create({
              data: {
                id: acao.dados.id,
                nome: acao.dados.nome,
                codigoPatrimonio: acao.dados.codigoPatrimonio,
                categoriaId: categoriaId,
                tipoId: tipoId,
                statusCondicao: statusCondicao,
                recebeuComDefeito: recebeuComDefeito,
                permitirEmprestimo: acao.dados.permitirEmprestimo !== undefined ? acao.dados.permitirEmprestimo : true,
                fotoUrl: fotoDefinitiva
              }
            });
            logs.push(`Novo equipamento ${acao.dados.codigoPatrimonio} cadastrado.`);
          }

          if (recebeuComDefeito && acao.dados.avariaId) {
            await prisma.historicoAvaria.create({
              data: {
                equipamentoId: existingEquip ? existingEquip.id : acao.dados.id,
                tipoAvariaId: acao.dados.avariaId,
                descricao: acao.dados.avariaDescricao || "Defeito inicial cadastrado via app offline",
                resolvido: false
              }
            }).catch(e => console.warn('Erro ao registrar avaria inicial:', e));
          }
        }
      } catch (errAction) {
        console.error(`[SYNC] Erro ao processar ação ${acao.tipo}:`, errAction);
        logs.push(`Erro na ação ${acao.tipo}: ${errAction instanceof Error ? errAction.message : 'Erro interno'}`);
      }
    }

    // Notificações WhatsApp pós-sync
    for (const reqId of Object.keys(reqsAtualizadas)) {
      const equipamentosEntregues = reqsAtualizadas[reqId];
      if (equipamentosEntregues.length > 0) {
        const reqDb = await prisma.requisicao.findUnique({ where: { id: reqId } });
        if (reqDb) {
          await prisma.requisicao.update({
            where: { id: reqId },
            data: { status: 'AGUARDANDO_DEVOLUCAO' }
          }).catch(e => console.warn('Erro ao atualizar status requisição:', e));

          if (reqDb.solicitanteWhatsapp) {
            let digits = reqDb.solicitanteWhatsapp.replace(/\D/g, '');
            if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
            const num = digits + '@s.whatsapp.net';
            const msg = `🚨 *Sua requisição de equipamentos acaba de ser entregue!*\n\nOlá, ${reqDb.solicitanteNome}. Os seguintes itens foram separados/entregues para você:\n- ${equipamentosEntregues.join('\n- ')}\n\nPor favor, cuide bem dos aparelhos!`;
            await whatsapp.sendMessage(num, msg).catch(e => console.error("Erro ao notificar entrega no WA:", e));
          }
        }
      }
    }

    for (const reqId of Object.keys(reqsDevolvidas)) {
      const equipamentosDevolvidos = reqsDevolvidas[reqId];
      if (equipamentosDevolvidos.length > 0) {
        const reqDb = await prisma.requisicao.findUnique({ where: { id: reqId }, include: { itens: true } });
        if (reqDb) {
          const itensSeparados = reqDb.itens.filter(i => i.statusSeparacao);
          const todosDevolvidos = itensSeparados.length > 0 && itensSeparados.every(i => i.statusDevolucao);
          
          if (todosDevolvidos && reqDb.status !== 'DEVOLVIDO') {
            await prisma.requisicao.update({
              where: { id: reqId },
              data: { status: 'DEVOLVIDO' }
            }).catch(e => console.warn('Erro ao finalizar requisição:', e));

            const countAvarias = await prisma.historicoAvaria.count({ where: { requisicaoId: reqId } });
            const observacaoAvaria = countAvarias > 0 ? " Observamos que houve relato de avaria, defeito ou pendência em algum(ns) dos itens devolvidos." : "";

            if (reqDb.solicitanteWhatsapp) {
              let digits = reqDb.solicitanteWhatsapp.replace(/\D/g, '');
              if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
              const num = digits + '@s.whatsapp.net';
              const msg = `Olá, ${reqDb.solicitanteNome}! Recebemos os equipamentos de volta.${observacaoAvaria} Agradecemos pelo cuidado e até a próxima!`;
              await whatsapp.sendMessage(num, msg).catch(e => console.error("Erro ao notificar devolução no WA:", e));
            }
          }
        }
      }
    }

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Erro no PUSH:', error);
    res.status(500).json({ error: 'Erro ao processar dados de push' });
  }
});

export default router;

