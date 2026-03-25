-- ─────────────────────────────────────────────────────────────────
-- Encontros Especiais v2 — realocação temporária de alunos
-- 
-- Suporta redistribuição de N alunos para M professores diferentes.
-- Constraint: um aluno só pode ter UM destino por tipo de encontro
-- dentro do mesmo módulo de origem (evita ambiguidade no cálculo).
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "encontros_especiais" (
  "id"                  TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "aluno_id"            TEXT         NOT NULL,
  "modulo_origem_id"    TEXT         NOT NULL,
  "problema_destino_id" TEXT         NOT NULL,
  "tipo_encontro"       TEXT         NOT NULL,
  "observacao"          TEXT,
  "criado_em"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "encontros_especiais_pkey"
    PRIMARY KEY ("id"),

  -- Um aluno só pode ter UM destino por tipo de encontro no mesmo módulo de origem
  CONSTRAINT "encontros_especiais_aluno_origem_tipo_unique"
    UNIQUE ("aluno_id", "modulo_origem_id", "tipo_encontro"),

  CONSTRAINT "encontros_especiais_aluno_id_fkey"
    FOREIGN KEY ("aluno_id")            REFERENCES "usuarios"("id")  ON DELETE CASCADE,
  CONSTRAINT "encontros_especiais_modulo_origem_id_fkey"
    FOREIGN KEY ("modulo_origem_id")    REFERENCES "modulos"("id")   ON DELETE CASCADE,
  CONSTRAINT "encontros_especiais_problema_destino_id_fkey"
    FOREIGN KEY ("problema_destino_id") REFERENCES "problemas"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "encontros_especiais_aluno_idx"
  ON "encontros_especiais"("aluno_id");
CREATE INDEX IF NOT EXISTS "encontros_especiais_modulo_origem_idx"
  ON "encontros_especiais"("modulo_origem_id");
CREATE INDEX IF NOT EXISTS "encontros_especiais_problema_destino_idx"
  ON "encontros_especiais"("problema_destino_id");
