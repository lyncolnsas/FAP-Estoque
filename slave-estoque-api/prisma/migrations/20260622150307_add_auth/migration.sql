-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SETOR',
    "departamento" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Requisicao" (
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
    "atualizadoEm" DATETIME NOT NULL,
    "usuarioId" TEXT,
    CONSTRAINT "Requisicao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Requisicao" ("atualizadoEm", "criadoEm", "dataFimEvento", "dataInicioEvento", "dataRetiradaSugerida", "departamento", "id", "localEvento", "solicitanteEmail", "solicitanteNome", "solicitanteWhatsapp", "status", "tokenAceite") SELECT "atualizadoEm", "criadoEm", "dataFimEvento", "dataInicioEvento", "dataRetiradaSugerida", "departamento", "id", "localEvento", "solicitanteEmail", "solicitanteNome", "solicitanteWhatsapp", "status", "tokenAceite" FROM "Requisicao";
DROP TABLE "Requisicao";
ALTER TABLE "new_Requisicao" RENAME TO "Requisicao";
CREATE UNIQUE INDEX "Requisicao_tokenAceite_key" ON "Requisicao"("tokenAceite");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
