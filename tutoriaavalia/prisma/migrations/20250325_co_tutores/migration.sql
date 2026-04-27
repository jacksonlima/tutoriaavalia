-- ─────────────────────────────────────────────────────────────────
-- Co-tutores (professores substitutos) + Permissões granulares
-- ─────────────────────────────────────────────────────────────────

-- Tabela de co-tutores
CREATE TABLE IF NOT EXISTS "co_tutores" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "modulo_id" TEXT NOT NULL,
  "tutor_id"  TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "co_tutores_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "co_tutores_modulo_id_tutor_id_key" UNIQUE ("modulo_id","tutor_id"),
  CONSTRAINT "co_tutores_modulo_id_fkey"   FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id")   ON DELETE CASCADE,
  CONSTRAINT "co_tutores_tutor_id_fkey"    FOREIGN KEY ("tutor_id")  REFERENCES "usuarios"("id")  ON DELETE CASCADE
);

-- Permissões granulares por problema + tipo de encontro
CREATE TABLE IF NOT EXISTS "co_tutor_permissoes" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "co_tutor_id"   TEXT        NOT NULL,
  "problema_id"   TEXT        NOT NULL,
  "tipo_encontro" TEXT        NOT NULL,
  CONSTRAINT "co_tutor_permissoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "co_tutor_permissoes_unique" UNIQUE ("co_tutor_id","problema_id","tipo_encontro"),
  CONSTRAINT "co_tutor_permissoes_co_tutor_id_fkey"  FOREIGN KEY ("co_tutor_id")  REFERENCES "co_tutores"("id")  ON DELETE CASCADE,
  CONSTRAINT "co_tutor_permissoes_problema_id_fkey"  FOREIGN KEY ("problema_id")  REFERENCES "problemas"("id")  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "co_tutores_modulo_id_idx"          ON "co_tutores"("modulo_id");
CREATE INDEX IF NOT EXISTS "co_tutores_tutor_id_idx"           ON "co_tutores"("tutor_id");
CREATE INDEX IF NOT EXISTS "co_tutor_permissoes_co_tutor_idx"  ON "co_tutor_permissoes"("co_tutor_id");
CREATE INDEX IF NOT EXISTS "co_tutor_permissoes_problema_idx"  ON "co_tutor_permissoes"("problema_id");
