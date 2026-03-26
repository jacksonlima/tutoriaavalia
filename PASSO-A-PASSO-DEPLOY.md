# TutoriaAvalia v2 — Passo a Passo: Teste Local, GitHub e Vercel

**Autor:** Jackson Lima — CESUPA  
**Atualizado:** 2026

---

## PARTE 1 — TESTAR LOCALMENTE (novo computador)

### Pré-requisitos
- **Node.js 18+** → https://nodejs.org (baixe a versão LTS)
- **Git** → https://git-scm.com

### Passos

```bash
# 1. Extrair o ZIP em uma pasta de sua escolha
#    (ex: ~/projetos/tutoriaavalia)

# 2. Entrar na pasta
cd tutoriaavalia

# 3. Instalar dependências
npm install

# 4. Copiar o modelo de variáveis de ambiente
cp .env.example .env.local

# 5. Editar .env.local com suas credenciais reais
#    Abra o arquivo no seu editor e preencha:
#    - GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (Google Cloud Console)
#    - NEXTAUTH_SECRET  → rode: openssl rand -base64 32
#    - DATABASE_URL e DIRECT_DATABASE_URL (painel do Neon)
#    - NEXTAUTH_URL=http://localhost:3000

# 6. Gerar o Prisma Client
npx prisma generate

# 7. Sincronizar o schema com o banco
npx prisma db push

# 8. Popular o banco com dados de teste (opcional)
npm run db:seed

# 9. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000  
Login de desenvolvimento (sem Google): http://localhost:3000/dev/login

---

## PARTE 2 — ATUALIZAR O GITHUB

### Se ainda não tem o repo no Git local

```bash
cd tutoriaavalia

# Inicializar o repositório
git init
git remote add origin https://github.com/SEU_USUARIO/tutoriaavalia.git

# Primeiro commit
git add .
git commit -m "feat: TutoriaAvalia v2 — versão inicial"
git branch -M main
git push -u origin main
```

### Se já tem o repo e quer atualizar com estes arquivos

```bash
cd tutoriaavalia   # sua pasta local do repositório

# Copie os arquivos do ZIP por cima (no Mac/Linux):
cp -r ~/Downloads/tutoriaavalia/. .

# Ver o que mudou
git status
git diff --stat

# Adicionar tudo
git add .

# Commit com mensagem descritiva do que foi corrigido
git commit -m "fix: corrige campo matriculas sem acento nas queries Prisma

- PrismaClientValidationError: 'matrículas' → 'matriculas' em 9 arquivos
- next.config.js: serverExternalPackages movido para experimental (Next.js 14.x)
- package.json: next 14.2.18 → 14.2.35 (patch de segurança)
- README: ano 2025 → 2026"

# Enviar para o GitHub
git push origin main
```

---

## PARTE 3 — DEPLOY NA VERCEL

### A Vercel faz o deploy automaticamente após o git push

Após o `git push`, a Vercel detecta a mudança e inicia o build sozinha.  
Acompanhe em: https://vercel.com/dashboard → seu projeto → aba **Deployments**

### Variáveis de ambiente obrigatórias na Vercel

Se ainda não configurou, acesse:  
**Vercel Dashboard → seu projeto → Settings → Environment Variables**

| Variável | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Do Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Do Google Cloud Console |
| `NEXTAUTH_SECRET` | Gere com `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://tutoriaavalia.vercel.app` |
| `DATABASE_URL` | URL pooled do Neon (com `-pooler`) |
| `DIRECT_DATABASE_URL` | URL direta do Neon (sem `-pooler`) |
| `ALLOWED_EMAIL_DOMAIN` | `prof.cesupa.br,aluno.cesupa.br` |

### Após o primeiro deploy na Vercel, rodar o seed (se necessário)

```bash
# No seu computador local, apontando para o banco de produção:
# Edite temporariamente o .env.local com as URLs do Neon de produção
# e rode:
npm run db:seed
```

Ou use o Neon Dashboard → Console SQL para executar o seed manualmente.

---

## PARTE 4 — GOOGLE OAUTH (se mudou a URL)

Se a URL da Vercel mudou, adicione-a no Google Cloud Console:

1. Acesse: https://console.cloud.google.com → APIs → Credenciais
2. Clique na sua credencial OAuth
3. Em **Origens JavaScript autorizadas**, adicione:
   ```
   https://tutoriaavalia.vercel.app
   ```
4. Em **URIs de redirecionamento autorizados**, adicione:
   ```
   https://tutoriaavalia.vercel.app/api/auth/callback/google
   ```
5. Salve e aguarde alguns minutos para propagar.

---

## Comandos úteis

```bash
npm run dev           # Servidor local
npm run build         # Build de produção (teste antes do deploy)
npm run db:seed       # Recriar dados de teste
npm run db:studio     # Interface visual do banco (Prisma Studio)
npx prisma generate   # Regenerar Prisma Client
npx prisma db push    # Sincronizar schema → banco
```

---

*© 2026 Jackson Lima — CESUPA*
