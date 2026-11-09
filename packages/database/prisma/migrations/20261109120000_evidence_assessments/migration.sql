-- Aditiva. Avaliações RoB 2 (por estudo) e GRADE (por desfecho) de cada
-- membro, usadas em Estudar > Ferramentas. Acesso só pelo Prisma no servidor.
DO $$ BEGIN
  CREATE TYPE "EvidenceToolKind" AS ENUM ('ROB2', 'GRADE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "EvidenceAssessment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tool" "EvidenceToolKind" NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "data" JSONB NOT NULL,
    "result" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EvidenceAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvidenceAssessment_memberId_tool_updatedAt_idx"
  ON "EvidenceAssessment"("memberId", "tool", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "EvidenceAssessment" ADD CONSTRAINT "EvidenceAssessment_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sem policies: o acesso acontece pelo Prisma no servidor, como nas demais tabelas.
ALTER TABLE "EvidenceAssessment" ENABLE ROW LEVEL SECURITY;

-- Rollback (só com aprovação explícita, depois de confirmar que nada lê a tabela):
-- DROP TABLE IF EXISTS "EvidenceAssessment"; DROP TYPE IF EXISTS "EvidenceToolKind";
