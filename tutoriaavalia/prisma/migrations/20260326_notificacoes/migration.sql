-- CreateTable: notificacoes
-- Gerado para TutoriaAvalia v2 — Autor: Jackson Lima — CESUPA

CREATE TABLE "notificacoes" (
    "id"            TEXT NOT NULL,
    "tutor_id"      TEXT NOT NULL,
    "titulo"        TEXT NOT NULL,
    "mensagem"      TEXT NOT NULL,
    "problema_id"   TEXT,
    "tipo_encontro" TEXT,
    "lida"          BOOLEAN NOT NULL DEFAULT false,
    "criada_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_tutor_id_fkey"
    FOREIGN KEY ("tutor_id")
    REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Index para buscar notificações de um tutor rapidamente
CREATE INDEX "notificacoes_tutor_id_lida_idx" ON "notificacoes"("tutor_id", "lida");
