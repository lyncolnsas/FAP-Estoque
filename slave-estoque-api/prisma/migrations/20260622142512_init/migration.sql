-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigoPatrimonio" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "statusCondicao" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "recebeuComDefeito" BOOLEAN NOT NULL DEFAULT false,
    "quantidadeUso" INTEGER NOT NULL DEFAULT 0,
    "qrCodeUrl" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Requisicao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitanteNome" TEXT NOT NULL,
    "solicitanteEmail" TEXT,
    "solicitanteWhatsapp" TEXT,
    "departamento" TEXT NOT NULL,
    "localEvento" TEXT NOT NULL,
    "dataInicioEvento" DATETIME NOT NULL,
    "dataFimEvento" DATETIME NOT NULL,
    "dataRetiradaSugerida" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tokenAceite" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ItemRequisicao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requisicaoId" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "statusSeparacao" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ItemRequisicao_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES "Requisicao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemRequisicao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoricoAvaria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipamentoId" TEXT NOT NULL,
    "requisicaoId" TEXT,
    "descricao" TEXT NOT NULL,
    "dataRegistro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricoAvaria_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistoricoAvaria_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES "Requisicao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_codigoPatrimonio_key" ON "Equipamento"("codigoPatrimonio");

-- CreateIndex
CREATE UNIQUE INDEX "Requisicao_tokenAceite_key" ON "Requisicao"("tokenAceite");
