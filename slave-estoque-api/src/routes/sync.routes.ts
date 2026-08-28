import { Router } from 'express';
import { prisma } from '../prisma';
import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';
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

// Middleware de Proteção por Palavra Passe
async function checkSyncPassword(req: any, res: any, next: any) {
  try {
    const config = await prisma.configuracao.findUnique({ where: { chave: 'sync_password' } });
    if (config && config.valor && config.valor.trim() !== '') {
      const clientPassword = req.headers['x-sync-password'];
      if (clientPassword !== config.valor) {
        return res.status(401).json({ error: 'Senha de sincronização inválida.' });
      }
    }
    next();
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao validar segurança.' });
  }
}

// 1. Gera o Payload Criptografado para o QR Code (Sem senha para permitir a exibição no PWA)
router.get('/qr-payload', (req, res) => {
  const ips = getLocalIpAddresses();
  const port = Number(process.env.PORT) || 3333;
  const payload = JSON.stringify({ ips, port });
  
  const encrypted = CryptoJS.AES.encrypt(payload, SECRET_KEY).toString();
  
  res.json({ encryptedPayload: encrypted, ips, port });
});

// 2. Rota de PING (Para Discovery Local via HTTP / Handshake do QR Code)
router.get('/ping', checkSyncPassword, (req, res) => {
  res.json({ 
    service: 'slave-estoque-server', 
    version: '1.0', 
    timestamp: new Date().toISOString() 
  });
});

// 3. Rota de PULL (Mobile baixa dados)
router.get('/pull', checkSyncPassword, async (req, res) => {
  try {
    const [
      equipamentos,
      categorias,
      tipos,
      requisicoes,
      tiposAvaria,
      historicoAvarias,
      usuarios,
      locais,
      reservasLocais
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
        select: { id: true, nome: true, departamento: true, whatsapp: true, fotoPerfilUrl: true, corPersonalizada: true, role: true }
      }),
      prisma.local.findMany(),
      prisma.reservaLocal.findMany({
        include: {
          local: true,
          usuario: { select: { id: true, nome: true, departamento: true, fotoPerfilUrl: true } }
        }
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
      usuarios,
      locais,
      reservasLocais
    });
  } catch (error) {
    console.error('Erro no PULL:', error);
    res.status(500).json({ error: 'Erro ao gerar dados de pull' });
  }
});

// 4. Rota de PUSH (Mobile envia dados sincronizados)
router.post('/push', checkSyncPassword, async (req, res) => {
  try {
    const { acoes } = req.body;
    
    const logs: string[] = [];
    const reqsAtualizadas: Record<string, string[]> = {};
    const reqsDevolvidas: Record<string, string[]> = {};

    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

    for (const acao of acoes || []) {
      try {
        if (acao.tipo === 'NOVO_USUARIO') {
          const { id, nome, departamento, whatsapp: userWhatsapp, fotoPerfilUrl } = acao.dados || {};
          if (nome) {
            const cleanName = String(nome).trim();
            const existing = await prisma.usuario.findFirst({
              where: {
                OR: [
                  { nome: { equals: cleanName } },
                  ...(userWhatsapp ? [{ whatsapp: { equals: String(userWhatsapp).trim() } }] : [])
                ]
              }
            });

            if (!existing) {
              const generatedEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 6)}@estoque.local`;
              const dummyHash = await bcrypt.hash('123456', 10);
              let autoFoto = fotoPerfilUrl || null;
              
              if (userWhatsapp && (global as any).whatsappStatus === 'CONECTADO') {
                try {
                  const fetchedFoto = await whatsapp.getProfilePictureUrl(userWhatsapp);
                  if (fetchedFoto) autoFoto = fetchedFoto;
                } catch (e) {}
              }

              await prisma.usuario.create({
                data: {
                  id: id || undefined,
                  nome: cleanName,
                  departamento: departamento || 'Geral',
                  whatsapp: userWhatsapp || null,
                  email: generatedEmail,
                  senhaHash: dummyHash,
                  role: 'SETOR',
                  fotoPerfilUrl: autoFoto
                }
              });
              logs.push(`Novo usuário "${cleanName}" cadastrado via sincronização.`);
            } else {
              const dataUp: any = {};
              if (departamento && (!existing.departamento || existing.departamento === 'Geral')) dataUp.departamento = departamento;
              if (userWhatsapp && !existing.whatsapp) dataUp.whatsapp = userWhatsapp;
              if (userWhatsapp && !existing.fotoPerfilUrl && (global as any).whatsappStatus === 'CONECTADO') {
                try {
                  const fetchedFoto = await whatsapp.getProfilePictureUrl(userWhatsapp);
                  if (fetchedFoto) dataUp.fotoPerfilUrl = fetchedFoto;
                } catch (e) {}
              }
              if (Object.keys(dataUp).length > 0) {
                await prisma.usuario.update({
                  where: { id: existing.id },
                  data: dataUp
                });
              }
              logs.push(`Usuário "${cleanName}" vinculado sem duplicação.`);
            }
          }
          continue;
        }

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
        
        if (acao.tipo === 'NOVO_EQUIPAMENTO' || acao.tipo === 'EDITAR_EQUIPAMENTO') {
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

          const targetEquipId = existingEquip ? existingEquip.id : acao.dados.id;

          if (recebeuComDefeito && acao.dados.avariaId) {
            const avariaAberta = await prisma.historicoAvaria.findFirst({
              where: { equipamentoId: targetEquipId, tipoAvariaId: acao.dados.avariaId, resolvido: false }
            });
            if (!avariaAberta) {
              await prisma.historicoAvaria.create({
                data: {
                  equipamentoId: targetEquipId,
                  tipoAvariaId: acao.dados.avariaId,
                  descricao: acao.dados.avariaDescricao || "Defeito cadastrado via app offline",
                  resolvido: false
                }
              }).catch(e => console.warn('Erro ao registrar avaria:', e));
            }
          } else if (statusCondicao === 'DISPONIVEL' && !recebeuComDefeito) {
            await prisma.historicoAvaria.updateMany({
              where: { equipamentoId: targetEquipId, resolvido: false },
              data: { resolvido: true, dataResolucao: new Date() }
            }).catch(e => console.warn('Erro ao resolver avarias via sync:', e));
          }
        }

        if (acao.tipo === 'EMPRESTIMO_OFFLINE') {
          const { equipamentoId, patrimonio, solicitanteNome, departamento, dataCriacao } = acao.dados || {};
          const reqId = acao.itemId || `emp-${Date.now()}`;

          let targetEquipId = equipamentoId;
          if (patrimonio && !targetEquipId) {
            const eqByPatr = await prisma.equipamento.findUnique({ where: { codigoPatrimonio: patrimonio } });
            if (eqByPatr) targetEquipId = eqByPatr.id;
          } else if (targetEquipId) {
            const eqExists = await prisma.equipamento.findUnique({ where: { id: targetEquipId } });
            if (!eqExists && patrimonio) {
              const eqByPatr = await prisma.equipamento.findUnique({ where: { codigoPatrimonio: patrimonio } });
              if (eqByPatr) targetEquipId = eqByPatr.id;
            }
          }

          if (targetEquipId && solicitanteNome) {
            // 1. Tenta associar a um usuário existente no banco ou cria avulso
            let usuario = await prisma.usuario.findFirst({
              where: { nome: solicitanteNome }
            });

            const waNum = acao.dados?.whatsapp || usuario?.whatsapp || null;

            if (!usuario) {
              try {
                const generatedEmail = `${solicitanteNome.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 6)}@estoque.local`;
                const dummyHash = await bcrypt.hash('123456', 10);
                let autoFoto = null;
                if (waNum && (global as any).whatsappStatus === 'CONECTADO') {
                  try {
                    autoFoto = await whatsapp.getProfilePictureUrl(waNum);
                  } catch (e) {}
                }
                usuario = await prisma.usuario.create({
                  data: {
                    nome: solicitanteNome,
                    departamento: departamento || 'Geral',
                    whatsapp: waNum,
                    email: generatedEmail,
                    senhaHash: dummyHash,
                    role: 'SETOR',
                    fotoPerfilUrl: autoFoto
                  }
                });
              } catch (e) {
                console.warn('[SYNC] Erro ao criar usuário para empréstimo:', e);
              }
            } else if (usuario && (waNum || usuario.whatsapp) && !usuario.fotoPerfilUrl && (global as any).whatsappStatus === 'CONECTADO') {
              const targetPhone = waNum || usuario.whatsapp;
              try {
                const autoFoto = await whatsapp.getProfilePictureUrl(targetPhone);
                if (autoFoto) {
                  await prisma.usuario.update({
                    where: { id: usuario.id },
                    data: { fotoPerfilUrl: autoFoto }
                  });
                }
              } catch (e) {}
            }

            // 2. Cria a requisição caso não exista
            const reqExists = await prisma.requisicao.findUnique({ where: { id: reqId } });
            if (!reqExists) {
              const dataInicio = dataCriacao ? new Date(dataCriacao) : new Date();
              const dataFim = new Date(dataInicio.getTime() + 24 * 60 * 60 * 1000);

              await prisma.requisicao.create({
                data: {
                  id: reqId,
                  solicitanteNome: solicitanteNome,
                  departamento: departamento || (usuario?.departamento) || 'Geral',
                  solicitanteWhatsapp: waNum || usuario?.whatsapp || null,
                  usuarioId: usuario?.id || null,
                  status: 'EMPRESTADO',
                  dataInicioEvento: dataInicio,
                  dataFimEvento: dataFim,
                  dataRetiradaSugerida: dataInicio
                }
              });
            }

            // 3. Cria ou atualiza o ItemRequisicao
            const itemId = `item-${reqId}-${targetEquipId}`;
            const itemExists = await prisma.itemRequisicao.findFirst({
              where: {
                OR: [
                  { id: itemId },
                  { id: `item-${reqId}` },
                  { requisicaoId: reqId, equipamentoId: targetEquipId }
                ]
              }
            });

            if (!itemExists) {
              await prisma.itemRequisicao.create({
                data: {
                  id: itemId,
                  requisicaoId: reqId,
                  equipamentoId: targetEquipId,
                  statusSeparacao: true,
                  statusDevolucao: false
                }
              });
            } else {
              await prisma.itemRequisicao.update({
                where: { id: itemExists.id },
                data: { statusSeparacao: true, statusDevolucao: false }
              });
            }

            // 4. Atualiza o status do Equipamento para EMPRESTADO
            await prisma.equipamento.update({
              where: { id: targetEquipId },
              data: {
                statusCondicao: 'EMPRESTADO',
                quantidadeUso: { increment: 1 }
              }
            }).catch(e => console.warn('[SYNC] Erro ao atualizar status do equipamento:', e));

            logs.push(`Empréstimo ${reqId} do equipamento ${targetEquipId} para ${solicitanteNome} registrado no servidor.`);
          }
        }

        if (acao.tipo === 'NOVA_CATEGORIA') {
          const { id, nome } = acao.dados || {};
          if (nome) {
            const existingCat = await prisma.categoria.findFirst({ where: { nome } });
            if (!existingCat) {
              await prisma.categoria.create({
                data: { id: id || undefined, nome }
              });
              logs.push(`Categoria "${nome}" criada no servidor.`);
            } else {
              logs.push(`Categoria "${nome}" já existente.`);
            }
          }
        }

        if (acao.tipo === 'NOVO_TIPO_EQUIPAMENTO') {
          const { id, categoriaId, nome, categoriaNome } = acao.dados || {};
          if (nome) {
            let cat = categoriaId ? await prisma.categoria.findUnique({ where: { id: categoriaId } }) : null;
            if (!cat && categoriaNome) {
              cat = await prisma.categoria.findFirst({ where: { nome: categoriaNome } });
            }
            if (!cat) {
              cat = await prisma.categoria.findFirst({ where: { nome: 'Sem Categoria' } });
              if (!cat) cat = await prisma.categoria.create({ data: { nome: 'Sem Categoria' } });
            }

            const existingTipo = await prisma.tipoEquipamento.findFirst({
              where: { nome, categoriaId: cat.id }
            });
            if (!existingTipo) {
              await prisma.tipoEquipamento.create({
                data: { id: id || undefined, nome, categoriaId: cat.id }
              });
              logs.push(`Tipo "${nome}" vinculado à categoria "${cat.nome}" criado.`);
            }
          }
        }

        if (acao.tipo === 'NOVO_LOCAL') {
          const { id, nome, capacidade, fotoUrl } = acao.dados || {};
          if (nome) {
            const existingLocal = await prisma.local.findFirst({ where: { nome } });
            if (existingLocal) {
              await prisma.local.update({
                where: { id: existingLocal.id },
                data: {
                  capacidade: capacidade ? Number(capacidade) : existingLocal.capacidade,
                  fotoUrl: fotoUrl || existingLocal.fotoUrl
                }
              });
              logs.push(`Local "${nome}" atualizado no servidor.`);
            } else {
              await prisma.local.create({
                data: {
                  id: id || undefined,
                  nome,
                  capacidade: capacidade ? Number(capacidade) : 0,
                  fotoUrl: fotoUrl || null
                }
              });
              logs.push(`Novo local "${nome}" cadastrado no servidor.`);
            }
          }
        }

        if (acao.tipo === 'NOVA_RESERVA_LOCAL') {
          const { id, localId, localNome, solicitanteNome, dataInicio, dataFim } = acao.dados || {};
          let targetLocalId = localId;
          if (!targetLocalId && localNome) {
            const l = await prisma.local.findFirst({ where: { nome: localNome } });
            if (l) targetLocalId = l.id;
          }
          if (targetLocalId) {
            let u = solicitanteNome ? await prisma.usuario.findFirst({ where: { nome: solicitanteNome } }) : null;
            if (!u) {
              u = await prisma.usuario.findFirst({ where: { role: 'ADMIN' } });
            }
            if (u) {
              await prisma.reservaLocal.create({
                data: {
                  id: id || undefined,
                  localId: targetLocalId,
                  usuarioId: u.id,
                  dataInicio: dataInicio ? new Date(dataInicio) : new Date(),
                  dataFim: dataFim ? new Date(dataFim) : new Date(Date.now() + 2 * 3600000),
                  status: 'CONFIRMADA'
                }
              });
              logs.push(`Reserva do local sincronizada com sucesso.`);
            }
          }
        }

        if (acao.tipo === 'NOVO_TIPO_AVARIA') {
          const { id, nome, descricao } = acao.dados || {};
          if (nome) {
            const existing = await prisma.tipoAvaria.findFirst({ where: { nome } });
            if (!existing) {
              await prisma.tipoAvaria.create({
                data: { id: id || undefined, nome, descricao: descricao || null }
              });
              logs.push(`Tipo de Avaria "${nome}" cadastrado no servidor.`);
            }
          }
        }

        if (acao.tipo === 'NOVA_AVARIA_REGISTRO') {
          const { id, equipamentoId, tipoAvariaId, descricao, dataRegistro } = acao.dados || {};
          if (equipamentoId) {
            await prisma.historicoAvaria.create({
              data: {
                id: id || undefined,
                equipamentoId,
                tipoAvariaId: tipoAvariaId || null,
                descricao: descricao || 'Avaria reportada via aplicativo offline',
                resolvido: false,
                dataRegistro: dataRegistro ? new Date(dataRegistro) : new Date()
              }
            });
            await prisma.equipamento.update({
              where: { id: equipamentoId },
              data: { statusCondicao: 'COM_DEFEITO' }
            }).catch(() => {});
            logs.push(`Avaria registrada para o equipamento ${equipamentoId}.`);
          }
        }

        if (acao.tipo === 'RESOLVER_AVARIA') {
          const targetId = acao.itemId || (acao.dados && acao.dados.avariaId);
          const eqId = acao.dados && acao.dados.equipamentoId;
          if (targetId) {
            await prisma.historicoAvaria.update({
              where: { id: targetId },
              data: { resolvido: true, dataResolucao: new Date() }
            }).catch(() => {});
          }
          if (eqId) {
            const abertas = await prisma.historicoAvaria.count({
              where: { equipamentoId: eqId, resolvido: false }
            });
            if (abertas === 0) {
              await prisma.equipamento.update({
                where: { id: eqId },
                data: { statusCondicao: 'DISPONIVEL' }
              }).catch(() => {});
            }
          }
          logs.push(`Avaria ${targetId} resolvida no servidor.`);
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

