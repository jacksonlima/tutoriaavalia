-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Janela de Avaliação Complementar
-- Autor: Jackson Lima — CESUPA
-- Data: 2026-04-27
--
-- Contexto:
--   Um aluno pode chegar atrasado à tutoria (não estava na lista original).
--   O professor precisa adicioná-lo ao módulo APÓS as avaliações já terem sido
--   lançadas, e abrir uma "janela" para que os colegas avaliem apenas este aluno.
--
-- O que esta migration faz:
--   1. Cria a tabela janelas_complementares
--   2. Adiciona índice de performance
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabela principal: janela de avaliação para aluno tardio
CREATE TABLE "janelas_complementares" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "problema_id"   UUID          NOT NULL,
  "aluno_id"      UUID          NOT NULL,   -- aluno tardio que será avaliado
  "tipo_encontro" "TipoEncontro" NOT NULL,
  "aberta"        BOOLEAN       NOT NULL DEFAULT true,
  "criada_por_id" UUID          NOT NULL,   -- professor que criou
  "criada_em"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechada_em"    TIMESTAMP(3),             -- preenchido ao fechar

  CONSTRAINT "janelas_complementares_pkey"
    PRIMARY KEY ("id"),

  -- Um aluno só pode ter uma janela por problema/encontro
  CONSTRAINT "janelas_complementares_problema_aluno_tipo_key"
    UNIQUE ("problema_id", "aluno_id", "tipo_encontro"),

  CONSTRAINT "janelas_complementares_problema_id_fkey"
    FOREIGN KEY ("problema_id") REFERENCES "problemas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "janelas_complementares_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "janelas_complementares_criada_por_id_fkey"
    FOREIGN KEY ("criada_por_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2. Índice para busca rápida por problema (consulta frequente ao avaliar)
CREATE INDEX "janelas_complementares_problema_id_idx"
  ON "janelas_complementares" ("problema_id");

-- 3. Índice para busca por aluno (notificações no dashboard)
CREATE INDEX "janelas_complementares_aluno_id_idx"
  ON "janelas_complementares" ("aluno_id");
