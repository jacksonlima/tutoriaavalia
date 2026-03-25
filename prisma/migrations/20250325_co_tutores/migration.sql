-- Tabela de co-tutores (professores substitutos)
-- Permite que um docente titular adicione um substituto
-- para lançar notas em um módulo específico.
-- O substituto NÃO pode editar a estrutura do módulo
-- (alunos, problemas, arquivar, excluir) — apenas lançar notas.

CREATE TABLE IF NOT EXISTS "co_tutores" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "modulo_id" TEXT NOT NULL,
  "tutor_id"  TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "co_tutores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "co_tutores_modulo_id_tutor_id_key" UNIQUE ("modulo_id", "tutor_id"),
  CONSTRAINT "co_tutores_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "co_tutores_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "co_tutores_modulo_id_idx" ON "co_tutores"("modulo_id");
CREATE INDEX IF NOT EXISTS "co_tutores_tutor_id_idx" ON "co_tutores"("tutor_id");
