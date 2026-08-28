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
      statusCondicao TEXT DEFAULT 'DISPONIVEL',
      permitirEmprestimo INTEGER DEFAULT 1,
      recebeuComDefeito INTEGER DEFAULT 0,
      fotoUrl TEXT,
      synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Categoria (
      id TEXT PRIMARY KEY,
      nome TEXT,
      synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS TipoEquipamento (
      id TEXT PRIMARY KEY,
      categoriaId TEXT,
      nome TEXT,
      synced INTEGER DEFAULT 1
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
      dataResolucao TEXT,
      synced INTEGER DEFAULT 1
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
      whatsapp TEXT,
      fotoUrl TEXT,
      corPersonalizada TEXT,
      role TEXT DEFAULT 'SETOR'
    );

    CREATE TABLE IF NOT EXISTS EmprestimoOffline (
      id TEXT PRIMARY KEY,
      equipamentoId TEXT,
      equipamentoNome TEXT,
      patrimonio TEXT,
      solicitanteNome TEXT,
      departamento TEXT,
      dataCriacao TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Local (
      id TEXT PRIMARY KEY,
      nome TEXT,
      capacidade INTEGER DEFAULT 0,
      fotoUrl TEXT,
      synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ReservaLocal (
      id TEXT PRIMARY KEY,
      localId TEXT,
      usuarioId TEXT,
      solicitanteNome TEXT,
      departamento TEXT,
      dataInicio TEXT,
      dataFim TEXT,
      status TEXT DEFAULT 'CONFIRMADA',
      synced INTEGER DEFAULT 1
    );
  `);

  // Migrações seguras de colunas existentes (executadas para compatibilidade retroativa)
  const safeAlter = (sql) => {
    try { db.execSync(sql); } catch (e) {}
  };

  safeAlter(`ALTER TABLE Equipamento ADD COLUMN permitirEmprestimo INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE Equipamento ADD COLUMN recebeuComDefeito INTEGER DEFAULT 0;`);
  safeAlter(`ALTER TABLE Equipamento ADD COLUMN fotoUrl TEXT;`);
  safeAlter(`ALTER TABLE Equipamento ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE Local ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE Local ADD COLUMN capacidade INTEGER DEFAULT 0;`);
  safeAlter(`ALTER TABLE Local ADD COLUMN fotoUrl TEXT;`);
  safeAlter(`ALTER TABLE ReservaLocal ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE ItemRequisicao ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE HistoricoAvaria ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE Categoria ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE TipoEquipamento ADD COLUMN synced INTEGER DEFAULT 1;`);
  safeAlter(`ALTER TABLE Usuario ADD COLUMN fotoUrl TEXT;`);
  safeAlter(`ALTER TABLE Usuario ADD COLUMN corPersonalizada TEXT;`);
  safeAlter(`ALTER TABLE Usuario ADD COLUMN role TEXT DEFAULT 'SETOR';`);

  // Sanitização para garantir que nenhum registro pré-existente fique com synced = NULL
  safeAlter(`UPDATE HistoricoAvaria SET synced = 1 WHERE synced IS NULL;`);
  safeAlter(`UPDATE Equipamento SET synced = 1 WHERE synced IS NULL;`);
  safeAlter(`UPDATE Local SET synced = 1 WHERE synced IS NULL;`);
  safeAlter(`UPDATE ReservaLocal SET synced = 1 WHERE synced IS NULL;`);
  safeAlter(`UPDATE ItemRequisicao SET synced = 1 WHERE synced IS NULL;`);
  safeAlter(`UPDATE Categoria SET synced = 1 WHERE synced IS NULL;`);
  safeAlter(`UPDATE TipoEquipamento SET synced = 1 WHERE synced IS NULL;`);

  console.log('Banco de dados SQLite inicializado com sucesso.');
};
