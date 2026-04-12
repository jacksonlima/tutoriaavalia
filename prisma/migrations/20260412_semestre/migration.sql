-- Adiciona coluna semestre em modulos
-- TutoriaAvalia v2 — Autor: Jackson Lima — CESUPA
-- Valor padrão "01" para não quebrar módulos existentes

ALTER TABLE "modulos"
  ADD COLUMN IF NOT EXISTS "semestre" TEXT NOT NULL DEFAULT '01';
