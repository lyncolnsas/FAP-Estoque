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
    
    const res = await fetch(`http://${ip}:${port}/sync/ping`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      return data.service === 'slave-estoque-server';
    }
    return false;
  } catch (error) {
    console.error('Handshake falhou:', error);
    return false;
  }
};

export const syncPull = async () => {
  if (!API_URL) throw new Error('Servidor não configurado. Leia o QR Code.');

  const res = await fetch(`${API_URL}/sync/pull`);
  const data = await res.json();

  db.execSync('DELETE FROM Equipamento WHERE synced = 1');
  db.execSync('DELETE FROM Categoria');
  db.execSync('DELETE FROM TipoEquipamento');
  db.execSync('DELETE FROM Requisicao');
  db.execSync('DELETE FROM ItemRequisicao WHERE synced = 1');
  db.execSync('DELETE FROM TipoAvaria');
  db.execSync('DELETE FROM HistoricoAvaria');
  db.execSync('DELETE FROM Usuario');

  for (const eq of data.equipamentos) {
    db.runSync(
      `INSERT OR REPLACE INTO Equipamento (id, codigoPatrimonio, nome, categoriaId, tipoId, statusCondicao, permitirEmprestimo, recebeuComDefeito, fotoUrl, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [eq.id, eq.codigoPatrimonio, eq.nome, eq.categoriaId, eq.tipoId, eq.statusCondicao, eq.permitirEmprestimo ? 1 : 0, eq.recebeuComDefeito ? 1 : 0, eq.fotoUrl]
    );
  }

  for (const cat of data.categorias) {
    db.runSync('INSERT INTO Categoria (id, nome) VALUES (?, ?)', [cat.id, cat.nome]);
  }

  for (const t of data.tipos) {
    db.runSync('INSERT INTO TipoEquipamento (id, categoriaId, nome) VALUES (?, ?, ?)', [t.id, t.categoriaId, t.nome]);
  }

  for (const req of data.requisicoes) {
    db.runSync('INSERT INTO Requisicao (id, solicitanteNome, departamento, status) VALUES (?, ?, ?, ?)', 
      [req.id, req.solicitanteNome, req.departamento, req.status]);
  }

  for (const item of data.itensRequisicao) {
    db.runSync(`INSERT OR REPLACE INTO ItemRequisicao (id, requisicaoId, equipamentoId, statusSeparacao, statusDevolucao, synced) 
                VALUES (?, ?, ?, ?, ?, 1)`, 
      [item.id, item.requisicaoId, item.equipamentoId, item.statusSeparacao ? 1 : 0, item.statusDevolucao ? 1 : 0]);
  }

  for (const ta of data.tiposAvaria || []) {
    db.runSync('INSERT INTO TipoAvaria (id, nome, descricao) VALUES (?, ?, ?)', [ta.id, ta.nome, ta.descricao]);
  }

  for (const ha of data.historicoAvarias || []) {
    db.runSync(`INSERT INTO HistoricoAvaria (id, equipamentoId, requisicaoId, tipoAvariaId, descricao, resolvido, dataRegistro, dataResolucao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ha.id, ha.equipamentoId, ha.requisicaoId, ha.tipoAvariaId, ha.descricao, ha.resolvido ? 1 : 0, ha.dataRegistro, ha.dataResolucao]);
  }

  for (const u of data.usuarios || []) {
    db.runSync('INSERT INTO Usuario (id, nome, departamento, whatsapp) VALUES (?, ?, ?, ?)', [u.id, u.nome, u.departamento, u.whatsapp]);
  }
};

export const syncPush = async () => {
  if (!API_URL) throw new Error('Servidor não configurado.');

  const logs = db.getAllSync('SELECT * FROM OfflineLog WHERE synced = 0');
  if (logs.length === 0) return { success: true, message: 'Nenhuma ação offline pendente.' };

  const acoes = [];
  const logsParaRemover = [];
  const logsComFalha = [];
  
  // ETAPA 1: Enviar imagens via Multipart/Form-Data
  for (const log of logs) {
    let dados = log.dados ? JSON.parse(log.dados) : null;
    let falhouImagem = false;
    
    if (log.tipo === 'NOVO_EQUIPAMENTO' && dados && dados.fotoUrl && dados.fotoUrl.startsWith('file://')) {
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
          dados.fotoUrl = uploadData.url; // Assinatura: URL final no servidor
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

  const res = await fetch(`${API_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acoes })
  });
  
  const result = await res.json();
  if (result.success) {
    // Apenas marca como sincronizado os logs que entraram no 'acoes' (que não falharam)
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
