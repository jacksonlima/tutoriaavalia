# TutoriaAvalia v2 — Passo a Passo: Teste Local, GitHub e Vercel

**Autor:** Jackson Lima — CESUPA  
**Atualizado:** 2026

---

## PARTE 1 — TESTAR LOCALMENTE (novo computador)

### Pré-requisitos
- **Node.js 18+** → https://nodejs.org (versão LTS)
- **Git** → https://git-scm.com

### Passos

```bash
# 1. Extrair o ZIP e entrar na pasta
cd tutoriaavalia

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais reais:
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
#   NEXTAUTH_SECRET  →  openssl rand -base64 32
#   DATABASE_URL e DIRECT_DATABASE_URL (painel Neon)
#   NEXTAUTH_URL=http://localhost:3000

# 4. Gerar o Prisma Client
npx prisma generate

# 5. ⚠️ IMPORTANTE: criar a tabela de notificações no banco
npx prisma db push

# 6. Popular banco com dados de teste (opcional)
npm run db:seed

# 7. Iniciar o servidor
npm run dev
```

Acesse: http://localhost:3000  
Login de desenvolvimento (sem Google): http://localhost:3000/dev/login

---

## PARTE 2 — ATUALIZAR O GITHUB

### Se já tem o repo e quer atualizar com estes arquivos

```bash
# Copie os arquivos do ZIP por cima do seu repo local
cp -r ~/Downloads/tutoriaavalia/. ~/projetos/tutoriaavalia/

cd ~/projetos/tutoriaavalia

# Ver o que mudou
git status

# Adicionar tudo
git add .

# Commit
git commit -m "feat: sistema de notificações e contadores de submissão

NOVIDADES:
- Tabela 'notificacoes' no banco (migration 20260326_notificacoes)
- POST /api/avaliacoes/aluno: cria notificações ao receber submissão
- GET/PATCH /api/notificacoes: lista e marca como lidas
- GET /api/submissoes/contador: progresso X/Total por problema+tipo
- NotificationBell: sino no TopBar com polling 30s e badge de não lidas
- useContadorSubmissoes: hook com polling 60s para contadores
- ModuloCard: badges X/Total ao lado de Abertura/Fechamento/Salto Triplo
- Regras: tutor titular + co-tutores com permissão + encontros especiais

CORREÇÕES ANTERIORES:
- matriculas sem acento em 9 arquivos (PrismaClientValidationError)
- next.config.js: experimental.serverComponentsExternalPackages (Next.js 14.x)
- next@14.2.18 → 14.2.35 (patch de segurança)
- README: ano 2025 → 2026"

# Enviar
git push origin main
```

---

## PARTE 3 — DEPLOY NA VERCEL

### ⚠️ PASSO OBRIGATÓRIO: criar a tabela de notificações

A Vercel faz deploy automaticamente após o push, mas o banco precisa
da nova tabela `notificacoes`. Rode isso UMA VEZ na sua máquina
apontando para o banco de produção:

```bash
# Edite temporariamente .env.local com a DATABASE_URL do Neon de PRODUÇÃO
# (a URL sem -pooler, i.e. DIRECT_DATABASE_URL)
# Depois rode:
npx prisma db push

# OU execute o SQL direto no painel do Neon → Console:
```

```sql
CREATE TABLE IF NOT EXISTS "notificacoes" (
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

ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_tutor_id_fkey"
    FOREIGN KEY ("tutor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "notificacoes_tutor_id_lida_idx"
    ON "notificacoes"("tutor_id", "lida");
```

### Variáveis de ambiente na Vercel

Acesse: **Vercel Dashboard → seu projeto → Settings → Environment Variables**

| Variável              | Valor                                    |
|-----------------------|------------------------------------------|
| GOOGLE_CLIENT_ID      | Do Google Cloud Console                  |
| GOOGLE_CLIENT_SECRET  | Do Google Cloud Console                  |
| NEXTAUTH_SECRET       | `openssl rand -base64 32`               |
| NEXTAUTH_URL          | `https://tutoriaavalia.vercel.app`       |
| DATABASE_URL          | URL pooled do Neon (com `-pooler`)       |
| DIRECT_DATABASE_URL   | URL direta do Neon (sem `-pooler`)       |
| ALLOWED_EMAIL_DOMAIN  | `prof.cesupa.br,aluno.cesupa.br`         |

---

## PARTE 4 — GOOGLE OAUTH (se a URL mudou)

1. https://console.cloud.google.com → APIs → Credenciais
2. Origens autorizadas: `https://tutoriaavalia.vercel.app`
3. URIs de redirecionamento: `https://tutoriaavalia.vercel.app/api/auth/callback/google`

---

## Comandos úteis

```bash
npm run dev           # Servidor local
npm run build         # Testa o build antes do deploy
npm run db:seed       # Recriar dados de teste
npm run db:studio     # Interface visual do banco
npx prisma generate   # Regenerar Prisma Client
npx prisma db push    # Sincronizar schema → banco
```

---

*© 2026 Jackson Lima — CESUPA*
