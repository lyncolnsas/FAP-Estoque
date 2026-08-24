import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('estoque.db');

export const initDB = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS Equipamento (
      id TEXT PRIMARY KEY,
      codigoPatrimonio TEXT,
      nome TEXT,
      categoriaId TEXT,
      tipoId TEXT,
      statusCondicao TEXT,
      permitirEmprestimo INTEGER,
      recebeuComDefeito INTEGER DEFAULT 0,
      fotoUrl TEXT,
      synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Categoria (
      id TEXT PRIMARY KEY,
      nome TEXT
    );

    CREATE TABLE IF NOT EXISTS TipoEquipamento (
      id TEXT PRIMARY KEY,
      categoriaId TEXT,
      nome TEXT
    );

    CREATE TABLE IF NOT EXISTS Requisicao (
      id TEXT PRIMARY KEY,
      solicitanteNome TEXT,
      departamento TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS ItemRequisicao (
      id TEXT PRIMARY KEY,
      requisicaoId TEXT,
      equipamentoId TEXT,
      statusSeparacao INTEGER DEFAULT 0,
      statusDevolucao INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 1,
      offlineAcao TEXT
    );
    
    CREATE TABLE IF NOT EXISTS TipoAvaria (
      id TEXT PRIMARY KEY,
      nome TEXT,
      descricao TEXT
    );

    CREATE TABLE IF NOT EXISTS HistoricoAvaria (
      id TEXT PRIMARY KEY,
      equipamentoId TEXT,
      requisicaoId TEXT,
      tipoAvariaId TEXT,
      descricao TEXT,
      resolvido INTEGER DEFAULT 0,
      dataRegistro TEXT,
      dataResolucao TEXT
    );

    CREATE TABLE IF NOT EXISTS OfflineLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT,
      itemId TEXT,
      dados TEXT,
      data TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Usuario (
      id TEXT PRIMARY KEY,
      nome TEXT,
      departamento TEXT,
      whatsapp TEXT
    );
  `);
  console.log('Banco de dados inicializado com sucesso.');
};
