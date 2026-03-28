-- Adiciona coluna faltou em avaliacoes_tutor
-- TutoriaAvalia v2 — Autor: Jackson Lima — CESUPA

ALTER TABLE "avaliacoes_tutor"
  ADD COLUMN IF NOT EXISTS "faltou" BOOLEAN NOT NULL DEFAULT false;

-- Index para buscar rapidamente faltosos por problema+tipo
CREATE INDEX IF NOT EXISTS "avaliacoes_tutor_faltou_idx"
  ON "avaliacoes_tutor"("problema_id", "tipo_encontro", "faltou");
