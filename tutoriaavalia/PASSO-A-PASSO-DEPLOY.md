# TutoriaAvalia v2 — Passo a Passo Completo

**Autor:** Jackson Lima — CESUPA  
**Atualizado:** Março 2026

---

## PARTE 1 — TESTE LOCAL (mesmo computador)

```bash
cd tutoriaavalia
npm install
npx prisma generate
npx prisma db push
npm run db:seed:ataque    # turma Ataque e Defesa (8 alunos, 5 problemas)
npm run dev
```

Acesse: http://localhost:3000/dev/login

---

## PARTE 2 — TESTE NO iPHONE via ngrok

### Instalar ngrok (uma vez)
```bash
brew install ngrok
ngrok config add-authtoken SEU_TOKEN   # em ngrok.com → conta gratuita
```

### Rodar
```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000
```

No iPhone acesse: `https://xxx.ngrok-free.app/dev/login`

---

## PARTE 3 — GIT: ATUALIZAR O REPOSITÓRIO

### Se é o primeiro push deste projeto
```bash
cd tutoriaavalia
git init
git remote add origin https://github.com/SEU_USUARIO/tutoriaavalia.git
git add .
git commit -m "feat: TutoriaAvalia v2 — versão completa"
git branch -M main
git push -u origin main
```

### Se o repositório já existe (atualizar com novos arquivos)
```bash
cd ~/projetos/tutoriaavalia

# Copiar arquivos do ZIP
cp -r ~/Downloads/tutoriaavalia/. .

# Limpar cache do Next.js (importante após mudar next.config.js ou middleware)
rm -rf .next

git add .
git status   # conferir o que vai ser commitado

git commit -m "feat/fix: notificações, faltou, correção de cálculos e acesso mobile

FUNCIONALIDADES:
- Sistema de notificações: sino no TopBar + polling 30s
- Contadores X/Total de submissões por encontro no ModuloCard
- Checkbox Faltou no painel do tutor (exclui interpares do faltoso)
- Cards de preview Média / M-At operação / M-At resultado (formulário aluno)
- Visual verde na auto-avaliação do aluno
- Descrição dos critérios (1.1, 1.2...) na revisão e tela de concluído
- Seeds: Introdução ao Estudo da Medicina e Ataque e Defesa

CORREÇÕES DE CÁLCULO:
- calcNotaEncontro: divisor 4.5 (não 5) quando auto-avaliação ausente
- notaAutoAvaliação → notaAutoAvaliacao (acento causava NaN no relatório)
- avaliacaoAluno.create → upsert (evita erro P2002 em reenvio)

CORREÇÕES DE ACESSO MOBILE (ngrok/IP local):
- next.config.js: allowedDevOrigins para domínios ngrok
- auth.ts: trustHost:true + cookie 'authjs.session-token' sem secure:false
- middleware.ts: cookieName alinhado com auth.ts
- api/dev/login: redirect usa x-forwarded-host do ngrok

CORREÇÕES DE BUILD/RUNTIME:
- next 14.2.18 → 14.2.35 (patch de segurança)
- serverExternalPackages → experimental.serverComponentsExternalPackages (Next.js 14)
- matrículas → matriculas em 9 arquivos (PrismaClientValidationError)
- /api/avaliações → /api/avaliacoes nas URLs de fetch
- migration 20260326: tabela notificacoes
- migration 20260328: campo faltou em avaliacoes_tutor"

git push origin main
```

---

## PARTE 4 — DEPLOY NA VERCEL

### Após o git push a Vercel faz deploy automático.
Acompanhe em: https://vercel.com/dashboard → seu projeto → Deployments

### Variáveis obrigatórias na Vercel
Settings → Environment Variables:

| Variável | Valor |
|---|---|
| GOOGLE_CLIENT_ID | Do Google Cloud Console |
| GOOGLE_CLIENT_SECRET | Do Google Cloud Console |
| NEXTAUTH_SECRET | `openssl rand -base64 32` |
| NEXTAUTH_URL | `https://tutoriaavalia.vercel.app` |
| DATABASE_URL | URL pooled do Neon (com -pooler) |
| DIRECT_DATABASE_URL | URL direta do Neon (sem -pooler) |
| ALLOWED_EMAIL_DOMAIN | `prof.cesupa.br,aluno.cesupa.br` |

### SQL obrigatório no Neon (rodar uma vez após primeiro deploy)
Console.neon.tech → SQL Editor:

```sql
-- Tabela de notificações
CREATE TABLE IF NOT EXISTS "notificacoes" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "problema_id" TEXT,
    "tipo_encontro" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_tutor_id_fkey"
    FOREIGN KEY ("tutor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "notificacoes_tutor_id_lida_idx"
    ON "notificacoes"("tutor_id", "lida");

-- Campo faltou nas avaliações do tutor
ALTER TABLE "avaliacoes_tutor"
    ADD COLUMN IF NOT EXISTS "faltou" BOOLEAN NOT NULL DEFAULT false;
```

Ou via terminal local:
```bash
npx prisma db push
```

---

## COMANDOS ÚTEIS

```bash
npm run dev                # servidor local
npm run build              # testa build antes do deploy
npm run db:seed            # seed completo (8 tutorias, 2025)
npm run db:seed:intro      # seed Introdução ao Estudo da Medicina
npm run db:seed:ataque     # seed Ataque e Defesa (turma teste)
npm run db:studio          # interface visual do banco
npx prisma generate        # regenerar Prisma Client
npx prisma db push         # sincronizar schema → banco
rm -rf .next               # limpar cache Next.js (usar após mudar config)
```

---

*© 2026 Jackson Lima — CESUPA*
