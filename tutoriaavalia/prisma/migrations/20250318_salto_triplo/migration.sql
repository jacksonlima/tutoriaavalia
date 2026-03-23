-- Migração: Salto Triplo + Tutoria como texto + Turma como MD1-MD8
-- Execute no Supabase SQL Editor ou via: npx prisma migrate dev --name salto_triplo

-- 1. Adicionar novos valores ao enum TipoEncontro
ALTER TYPE "TipoEncontro" ADD VALUE IF NOT EXISTS 'FECHAMENTO_A';
ALTER TYPE "TipoEncontro" ADD VALUE IF NOT EXISTS 'FECHAMENTO_B';

-- 2. Alterar campo numeroTutoria (Int) para tutoria (Text) na tabela modulos
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "tutoria" TEXT;
UPDATE "modulos" SET "tutoria" = 'Tutoria ' || "numero_tutoria"::text WHERE "tutoria" IS NULL;
ALTER TABLE "modulos" ALTER COLUMN "tutoria" SET NOT NULL;
ALTER TABLE "modulos" DROP COLUMN IF EXISTS "numero_tutoria";

-- 3. Remover constraint antiga e criar nova
ALTER TABLE "modulos" DROP CONSTRAINT IF EXISTS "modulos_ano_numero_tutoria_turma_key";
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_ano_tutoria_turma_tutor_id_key"
  UNIQUE ("ano", "tutoria", "turma", "tutor_id");

-- 4. Adicionar campos de Salto Triplo na tabela problemas
ALTER TABLE "problemas" ADD COLUMN IF NOT EXISTS "tem_salto_triplo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "problemas" ADD COLUMN IF NOT EXISTS "fechamento_a_ativo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "problemas" ADD COLUMN IF NOT EXISTS "fechamento_b_ativo" BOOLEAN NOT NULL DEFAULT false;

-- 5. Adicionar campo arquivado na tabela modulos (para arquivar módulos sem excluir)
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "arquivado" BOOLEAN NOT NULL DEFAULT false;
