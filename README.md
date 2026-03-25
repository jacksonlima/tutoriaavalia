# TutoriaAvalia v2

Sistema web de avaliação formativa para Aprendizagem Baseada em Problemas (ABP).  
Desenvolvido por **Jackson Lima** — CESUPA.  
Mobile-first · Login Google OAuth · PostgreSQL (Neon) · Next.js 14 · Prisma · NextAuth v5.

---

## ⚡ Instalação em outro computador

### Pré-requisitos

**1. Node.js 20+**  
Baixe em [nodejs.org](https://nodejs.org) (versão LTS).  
Verifique: `node --version` → deve mostrar `v20.x.x`

**2. Git**  
Baixe em [git-scm.com](https://git-scm.com)

---

### Configuração do projeto

**3. Clonar o repositório**
```bash
git clone https://github.com/jacksonlima/tutoriaavalia.git
cd tutoriaavalia
npm install
```

**4. Criar o arquivo de variáveis de ambiente**
```bash
cp .env.example .env.local
```

Preencha o `.env.local` com suas credenciais:
```env
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
NEXTAUTH_SECRET=   # gere com: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://user:senha@ep-xxx-pooler.sa-east-1.aws.neon.tech/tutoriaavalia?sslmode=require
DIRECT_DATABASE_URL=postgresql://user:senha@ep-xxx.sa-east-1.aws.neon.tech/tutoriaavalia?sslmode=require
ALLOWED_EMAIL_DOMAIN=prof.cesupa.br
```

**5. Criar as tabelas no banco**
```bash
npx prisma generate
npx prisma db push
```

**6. Popular com dados de teste**
```bash
npm run db:seed
```

**7. Rodar o sistema**
```bash
npm run dev
```
Acesse: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Login de desenvolvimento

Para logar como aluno sem conta Google real, acesse:  
`http://localhost:3000/dev/login`  

> ⚠️ Esta página só funciona em `npm run dev`. Em produção é bloqueada automaticamente.

---

## 🏗 Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Autenticação | NextAuth.js v5 beta + Google OAuth |
| Banco de dados | PostgreSQL via Neon (serverless) |
| ORM | Prisma 5.22 |
| Deploy | Vercel |

---

## 📁 Estrutura do projeto

```
tutoriaavalia/
├── prisma/
│   ├── schema.prisma         # Modelo de dados
│   ├── seed.ts               # Dados de teste
│   └── migrations/           # Histórico de migrações
├── src/
│   ├── app/
│   │   ├── (auth)/login/     # Tela de login Google
│   │   ├── (professor)/      # Dashboard, módulos, avaliar, relatórios
│   │   ├── (aluno)/          # Dashboard e formulário de avaliação
│   │   ├── dev/login/        # Login de desenvolvimento (sem Google)
│   │   └── api/              # API REST
│   ├── components/
│   │   ├── ui/               # TopBar, Toaster, EmailAutocomplete
│   │   └── professor/        # ModuloCard
│   └── lib/
│       ├── auth.ts           # NextAuth + Google OAuth
│       ├── db.ts             # Prisma singleton
│       ├── notas.ts          # Fórmulas de cálculo de notas
│       ├── criterios.ts      # Critérios de avaliação
│       └── validations.ts    # Schemas Zod
├── .env.example              # Modelo de variáveis de ambiente
└── .env.local                # Suas credenciais (nunca commite!)
```

---

## 🧮 Fórmulas implementadas

Todas as fórmulas do Google Sheets foram migradas para `src/lib/notas.ts`:

| Função | Equivale no Sheets |
|--------|-------------------|
| `calcMedia(c1, c2, c3)` | `=MÉDIA(B4:D4)` |
| `calcMMenosAtTutor(...)` | `=SE(comp;"SATISFATÓRIO";(M-atitudes))` |
| `calcMMenosAtAluno(...)` | `=M-atitudes` |
| `calcNotaEncontro(...)` | `=(inter×0,5 + auto×0,5 + prof×4) / 5` |
| `calcNotaFormativa(...)` | `=M.Ab + M.Fe (máx 10)` |

**Regra do aluno faltoso:** auto=0, interpares=0, professor=0 → nota=0,00

---

## 🚀 Deploy em produção (Vercel)

```bash
git add .
git commit -m "deploy"
git push origin main
```

A Vercel detecta o push e faz o deploy automaticamente.

**Variáveis obrigatórias na Vercel:**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL           → https://seu-projeto.vercel.app
DATABASE_URL           → URL pooled do Neon
DIRECT_DATABASE_URL    → URL direta do Neon
ALLOWED_EMAIL_DOMAIN   → prof.cesupa.br
```

---

## 🛠 Comandos úteis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run db:studio    # Interface visual do banco (Prisma Studio)
npm run db:seed      # Recriar dados de teste (apaga tudo e recria)
npx prisma generate  # Regenerar Prisma Client
npx prisma db push   # Sincronizar schema com o banco
```

---

## ❓ Problemas comuns

| Erro | Solução |
|------|---------|
| `Cannot find module '@prisma/client'` | Execute `npx prisma generate` |
| `Can't reach database server` | Verifique `DATABASE_URL` no `.env.local` ou reative o projeto no Neon |
| Login retorna "Acesso negado" | Verifique `ALLOWED_EMAIL_DOMAIN` — deve ser `prof.cesupa.br` |
| Loop de redirecionamento | Limpe os cookies do browser e tente novamente |
| `NEXTAUTH_SECRET is not set` | Execute `openssl rand -base64 32` e cole no `.env.local` |
| Papel ALUNO após login | Execute no Neon SQL: `UPDATE usuarios SET papel='TUTOR' WHERE email='seu@email'` |
