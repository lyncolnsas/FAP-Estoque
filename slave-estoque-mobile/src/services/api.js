import { db } from '../db/database';
import CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECRET_KEY = 'minha-chave-secreta-estoque-123';

export let API_URL = ''; 

export const setApiUrl = (ip, port) => {
  API_URL = `http://${ip}:${port}`;
  AsyncStorage.setItem('LAST_API_IP', ip).catch(console.error);
  AsyncStorage.setItem('LAST_API_PORT', String(port)).catch(console.error);
};

// Getter sempre retorna o valor atual (evita binding morto em CommonJS)
export const getApiUrl = () => API_URL;

export const getSyncHeaders = async (extraHeaders = {}) => {
  const headers = { ...extraHeaders };
  try {
    const pwd = await AsyncStorage.getItem('SYNC_PASSWORD');
    if (pwd) {
      headers['x-sync-password'] = pwd;
    }
  } catch(e) {}
  return headers;
};

export const getApiMemory = async () => {
  try {
    const ip = await AsyncStorage.getItem('LAST_API_IP');
    const port = await AsyncStorage.getItem('LAST_API_PORT');
    if (ip && port) return { ip, port };
  } catch (error) {
    console.error('Erro ao ler memória do servidor:', error);
  }
  return null;
};

export const parseQrCode = (scannedData) => {
  try {
    // Tenta descriptografar usando AES
    const bytes = CryptoJS.AES.decrypt(scannedData, SECRET_KEY);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    const { ip, ips, port } = JSON.parse(decryptedData);
    if(ips && ips.length > 0 && port) {
       return { ips, port };
    } else if(ip && port) {
       return { ips: [ip], port };
    }
  } catch (error) {
    console.error('Erro ao ler QR Code criptografado:', error);
  }
  return null;
};

export const handshake = async (ip, port) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
    
    const headers = await getSyncHeaders({ 'Accept': 'application/json' });

    const res = await fetch(`http://${ip}:${port}/sync/ping`, {
      method: 'GET',
      signal: controller.signal,
      headers
    });
    
    clearTimeout(timeoutId);
    
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    
    if (res.ok) {
      const data = await res.json();
      return data.service === 'slave-estoque-server';
    }
    return false;
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      throw error;
    }
    console.error('Handshake falhou:', error);
    return false;
  }
};

export const syncPull = async () => {
  if (!API_URL) throw new Error('Servidor não configurado. Leia o QR Code.');

  const headers = await getSyncHeaders();
  const res = await fetch(`${API_URL}/sync/pull`, { headers });
  
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const data = await res.json();

  // ----- CACHE OFFLINE DE IMAGENS (EQUIPAMENTOS E LOCAIS) -----
  try {
    const imgDir = FileSystem.documentDirectory + 'images/';
    await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true }).catch(() => {});
    
    // 1. Equipamentos
    for (let i = 0; i < (data.equipamentos || []).length; i++) {
      const eq = data.equipamentos[i];
      if (eq.fotoUrl && eq.fotoUrl.startsWith('/uploads/')) {
        const fileName = eq.fotoUrl.split('/').pop();
        const fileUri = imgDir + fileName;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fileInfo.exists) {
            await FileSystem.downloadAsync(`${API_URL}${eq.fotoUrl}`, fileUri);
          }
          eq.fotoUrl = fileUri;
        } catch (downloadErr) {
          console.error("Erro ao cachear imagem de equipamento:", downloadErr);
        }
      }
    }

    // 2. Locais & Salas
    for (let i = 0; i < (data.locais || []).length; i++) {
      const loc = data.locais[i];
      if (loc.fotoUrl && loc.fotoUrl.startsWith('/uploads/')) {
        const fileName = loc.fotoUrl.split('/').pop();
        const fileUri = imgDir + fileName;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fileInfo.exists) {
            await FileSystem.downloadAsync(`${API_URL}${loc.fotoUrl}`, fileUri);
          }
          loc.fotoUrl = fileUri;
        } catch (downloadErr) {
          console.error("Erro ao cachear imagem de local:", downloadErr);
        }
      }
    }
  } catch (e) {
    console.error("Erro geral na preparação das imagens offline:", e);
  }
  // -------------------------------------

  // Garante que o esquema e as colunas (ex: synced) estejam 100% atualizados
  try { initDB(); } catch (e) {}

  const safeExec = (sql) => {
    try {
      db.execSync(sql);
    } catch (e) {
      console.warn("Aviso na limpeza local de sync:", e);
    }
  };

  safeExec('DELETE FROM Equipamento WHERE synced = 1 OR synced IS NULL');
  safeExec('DELETE FROM Categoria');
  safeExec('DELETE FROM TipoEquipamento');
  safeExec('DELETE FROM Requisicao');
  safeExec('DELETE FROM ItemRequisicao WHERE synced = 1 OR synced IS NULL');
  safeExec('DELETE FROM TipoAvaria');
  safeExec('DELETE FROM HistoricoAvaria WHERE synced = 1 OR synced IS NULL');
  safeExec('DELETE FROM Usuario');
  safeExec('DELETE FROM Local WHERE synced = 1 OR synced IS NULL');
  safeExec('DELETE FROM ReservaLocal WHERE synced = 1 OR synced IS NULL');
  safeExec('DELETE FROM EmprestimoOffline WHERE synced = 1');

  for (const eq of data.equipamentos || []) {
    db.runSync(
      `INSERT OR REPLACE INTO Equipamento (id, codigoPatrimonio, nome, categoriaId, tipoId, statusCondicao, permitirEmprestimo, recebeuComDefeito, fotoUrl, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [eq.id, eq.codigoPatrimonio, eq.nome, eq.categoriaId, eq.tipoId, eq.statusCondicao, eq.permitirEmprestimo ? 1 : 0, eq.recebeuComDefeito ? 1 : 0, eq.fotoUrl]
    );
  }

  for (const cat of data.categorias || []) {
    db.runSync('INSERT OR REPLACE INTO Categoria (id, nome, synced) VALUES (?, ?, 1)', [cat.id, cat.nome]);
  }

  for (const t of data.tipos || []) {
    db.runSync('INSERT OR REPLACE INTO TipoEquipamento (id, categoriaId, nome, synced) VALUES (?, ?, ?, 1)', [t.id, t.categoriaId, t.nome]);
  }

  for (const req of data.requisicoes || []) {
    db.runSync('INSERT INTO Requisicao (id, solicitanteNome, departamento, status) VALUES (?, ?, ?, ?)', 
      [req.id, req.solicitanteNome, req.departamento, req.status]);
  }

  for (const item of data.itensRequisicao || []) {
    db.runSync(`INSERT OR REPLACE INTO ItemRequisicao (id, requisicaoId, equipamentoId, statusSeparacao, statusDevolucao, synced) 
                VALUES (?, ?, ?, ?, ?, 1)`, 
      [item.id, item.requisicaoId, item.equipamentoId, item.statusSeparacao ? 1 : 0, item.statusDevolucao ? 1 : 0]);
  }

  for (const ta of data.tiposAvaria || []) {
    db.runSync('INSERT OR REPLACE INTO TipoAvaria (id, nome, descricao) VALUES (?, ?, ?)', [ta.id, ta.nome, ta.descricao]);
  }

  for (const ha of data.historicoAvarias || []) {
    db.runSync(`INSERT OR REPLACE INTO HistoricoAvaria (id, equipamentoId, requisicaoId, tipoAvariaId, descricao, resolvido, dataRegistro, dataResolucao, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [ha.id, ha.equipamentoId, ha.requisicaoId, ha.tipoAvariaId, ha.descricao, ha.resolvido ? 1 : 0, ha.dataRegistro, ha.dataResolucao]);
  }

  for (const u of data.usuarios || []) {
    db.runSync(
      'INSERT OR REPLACE INTO Usuario (id, nome, departamento, whatsapp, fotoUrl, corPersonalizada, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [u.id, u.nome, u.departamento, u.whatsapp, u.fotoPerfilUrl || u.fotoUrl || null, u.corPersonalizada || null, u.role || 'SETOR']
    );
  }

  for (const loc of data.locais || []) {
    db.runSync('INSERT OR REPLACE INTO Local (id, nome, capacidade, fotoUrl, synced) VALUES (?, ?, ?, ?, 1)', [loc.id, loc.nome, loc.capacidade || 0, loc.fotoUrl || null]);
  }

  for (const res of data.reservasLocais || []) {
    db.runSync(`INSERT OR REPLACE INTO ReservaLocal (id, localId, usuarioId, solicitanteNome, departamento, dataInicio, dataFim, status, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [res.id, res.localId, res.usuarioId || null, res.usuario?.nome || null, res.usuario?.departamento || null, res.dataInicio, res.dataFim, res.status || 'CONFIRMADA']);
  }
};

export const syncPush = async () => {
  if (!API_URL) throw new Error('Servidor não configurado.');

  // AUTO-HEAL: Garante que qualquer EmprestimoOffline pendente (synced = 0) esteja na fila de envio
  try {
    const empsPendentes = db.getAllSync('SELECT * FROM EmprestimoOffline WHERE synced = 0');
    for (const emp of empsPendentes) {
      const logExists = db.getFirstSync(
        'SELECT id FROM OfflineLog WHERE itemId = ? OR (tipo = "EMPRESTIMO_OFFLINE" AND dados LIKE ?)',
        [emp.id, `%${emp.equipamentoId || emp.patrimonio}%`]
      );
      if (!logExists) {
        db.runSync(
          'INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)',
          [
            'EMPRESTIMO_OFFLINE',
            emp.id,
            JSON.stringify({
              requisicaoId: emp.id,
              equipamentoId: emp.equipamentoId,
              patrimonio: emp.patrimonio,
              solicitanteNome: emp.solicitanteNome,
              departamento: emp.departamento,
              dataCriacao: emp.dataCriacao
            }),
            emp.dataCriacao || new Date().toISOString()
          ]
        );
      }
    }
  } catch (e) {
    console.warn('Aviso no auto-heal de empréstimos offline:', e);
  }

  const logs = db.getAllSync('SELECT * FROM OfflineLog WHERE synced = 0');
  if (logs.length === 0) return { success: true, message: 'Nenhuma ação offline pendente.' };

  const acoes = [];
  const logsParaRemover = [];
  const logsComFalha = [];
  
  // ETAPA 1: Enviar imagens via Multipart/Form-Data
  for (const log of logs) {
    let dados = log.dados ? JSON.parse(log.dados) : null;
    let falhouImagem = false;
    
    const isLocalFile = dados && dados.fotoUrl && (
      dados.fotoUrl.startsWith('file:') || 
      dados.fotoUrl.startsWith('/') || 
      dados.fotoUrl.startsWith('content:')
    );

    if ((log.tipo === 'NOVO_EQUIPAMENTO' || log.tipo === 'EDITAR_EQUIPAMENTO' || log.tipo === 'NOVO_LOCAL') && isLocalFile) {
      try {
        const fileUri = dados.fotoUrl;
        const filename = fileUri.split('/').pop();
        const match = /\.([^.]+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        const uploadRes = await FileSystem.uploadAsync(`${API_URL}/upload`, fileUri, {
          httpMethod: 'POST',
          uploadType: 1, // 1 = MULTIPART, 0 = BINARY_CONTENT
          fieldName: 'file',
          mimeType: type,
        });
        
        if (uploadRes.status === 200 || uploadRes.status === 201) {
          const uploadData = JSON.parse(uploadRes.body);
          dados.fotoUrl = uploadData.url; // Assinatura: URL final no servidor (/uploads/...)
        } else {
          console.error('Falha no upload da foto', uploadRes.body);
          falhouImagem = uploadRes.body || `HTTP Status ${uploadRes.status}`;
        }
      } catch (error) {
        console.error('Erro de rede enviando imagem', error);
        falhouImagem = error.message || 'Erro de rede desconhecido';
      }
    }
    
    // Se a imagem falhou, pulamos esse item para não mandar o JSON sem foto
    if (falhouImagem) {
      logsComFalha.push({ item: log, error: falhouImagem });
      continue; 
    }
    
    acoes.push({
      tipo: log.tipo,
      itemId: log.itemId,
      dados,
      data: log.data
    });
    logsParaRemover.push(log.id);
  }

  // ETAPA 2: Se temos ações validadas com imagens, enviamos o pacote JSON
  if (acoes.length === 0) {
    if (logsComFalha.length > 0) {
       throw new Error(`Falha no envio da imagem. Erro do servidor: ${logsComFalha[0].error}`);
    }
    return { success: true, message: 'Nenhuma ação válida para enviar.' };
  }

  const headers = await getSyncHeaders({ 'Content-Type': 'application/json' });

  const res = await fetch(`${API_URL}/sync/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ acoes })
  });
  
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  
  const result = await res.json();
  if (result.success) {
    // Atualiza o status local para synced = 1
    for (const acao of acoes) {
      try {
        if (acao.tipo === 'NOVO_LOCAL') {
          db.runSync('UPDATE Local SET synced = 1 WHERE id = ?', [acao.itemId]);
        } else if (acao.tipo === 'NOVO_EQUIPAMENTO' || acao.tipo === 'EDITAR_EQUIPAMENTO') {
          db.runSync('UPDATE Equipamento SET synced = 1 WHERE id = ?', [acao.itemId]);
          db.runSync('UPDATE HistoricoAvaria SET synced = 1 WHERE equipamentoId = ?', [acao.itemId]);
        } else if (acao.tipo === 'NOVA_RESERVA_LOCAL') {
          db.runSync('UPDATE ReservaLocal SET synced = 1 WHERE id = ?', [acao.itemId]);
        } else if (acao.tipo === 'NOVA_CATEGORIA') {
          db.runSync('UPDATE Categoria SET synced = 1 WHERE id = ?', [acao.itemId]);
        } else if (acao.tipo === 'NOVO_TIPO_EQUIPAMENTO') {
          db.runSync('UPDATE TipoEquipamento SET synced = 1 WHERE id = ?', [acao.itemId]);
        } else if (acao.tipo === 'NOVA_AVARIA_REGISTRO') {
          db.runSync('UPDATE HistoricoAvaria SET synced = 1 WHERE id = ?', [acao.itemId]);
        } else if (acao.tipo === 'RESOLVER_AVARIA') {
          db.runSync('UPDATE HistoricoAvaria SET synced = 1 WHERE id = ?', [acao.itemId]);
          if (acao.dados && acao.dados.equipamentoId) {
            db.runSync('UPDATE Equipamento SET synced = 1 WHERE id = ?', [acao.dados.equipamentoId]);
          }
        } else if (acao.tipo === 'EMPRESTIMO_OFFLINE') {
          db.runSync('UPDATE EmprestimoOffline SET synced = 1 WHERE id = ?', [acao.itemId]);
          db.runSync('UPDATE ItemRequisicao SET synced = 1 WHERE requisicaoId = ?', [acao.itemId]);
          if (acao.dados && acao.dados.equipamentoId) {
            db.runSync('UPDATE EmprestimoOffline SET synced = 1 WHERE equipamentoId = ?', [acao.dados.equipamentoId]);
            db.runSync('UPDATE Equipamento SET synced = 1, statusCondicao = "EMPRESTADO" WHERE id = ?', [acao.dados.equipamentoId]);
          }
          if (acao.dados && acao.dados.patrimonio) {
            db.runSync('UPDATE EmprestimoOffline SET synced = 1 WHERE patrimonio = ?', [acao.dados.patrimonio]);
            db.runSync('UPDATE Equipamento SET synced = 1, statusCondicao = "EMPRESTADO" WHERE codigoPatrimonio = ?', [acao.dados.patrimonio]);
          }
        }
      } catch (e) {
        console.warn('Erro ao marcar entidade como synced:', e);
      }
    }

    // Apenas remove os logs offline que foram enviados com sucesso
    for (const id of logsParaRemover) {
       db.runSync('UPDATE OfflineLog SET synced = 1 WHERE id = ?', [id]);
    }
    db.runSync('DELETE FROM OfflineLog WHERE synced = 1');
  }

  if (logsComFalha.length > 0) {
     return { success: true, message: `${acoes.length} enviados com sucesso, mas ${logsComFalha.length} falharam na foto. Erro: ${logsComFalha[0].error}`, temFalhas: true, falhas: logsComFalha.length };
  }

  return result;
};
