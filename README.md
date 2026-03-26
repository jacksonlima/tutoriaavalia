# TutoriaAvalia v2

**Autor:** Jackson Lima — CESUPA  
**Contato:** jackson.lima@prof.cesupa.br

Sistema web de avaliação formativa para Aprendizagem Baseada em Problemas (ABP).  
Mobile-first · Login Google OAuth · PostgreSQL (Neon) · Next.js 14 · Prisma · NextAuth v5.

---

## ⚡ Instalação em outro computador

### Pré-requisitos

- **Node.js 18+** → [nodejs.org](https://nodejs.org) (versão LTS)
- **Git** → [git-scm.com](https://git-scm.com)

### Configuração

```bash
# 1. Extrair o ZIP e instalar dependências
cd tutoriaavalia
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais

# 3. Sincronizar banco e gerar Prisma Client
npx prisma generate
npx prisma db push

# 4. Popular banco com dados de teste
npm run db:seed

# 5. Rodar
npm run dev
```

Acesse: `http://localhost:3000`  
Login de desenvolvimento: `http://localhost:3000/dev/login`

---

## 🏗 Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Estilização | Tailwind CSS |
| Autenticação | NextAuth.js v5 beta + Google OAuth |
| Banco de dados | PostgreSQL via Neon (serverless) |
| ORM | Prisma 6 |
| Deploy | Vercel |

---

## 📁 Estrutura do projeto

```
tutoriaavalia/
├── prisma/
│   ├── schema.prisma          # Modelo de dados
│   ├── seed.ts                # Dados de teste (8 tutores · 80 alunos)
│   └── migrations/            # Histórico de migrações SQL
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Tela de login Google
│   │   ├── (professor)/       # Dashboard, módulos, avaliar, relatórios, realocar
│   │   ├── (aluno)/           # Dashboard e formulário de avaliação
│   │   ├── dev/login/         # Login de desenvolvimento (sem Google)
│   │   └── api/               # REST API completa
│   ├── components/
│   │   ├── ui/                # TopBar, Toaster, EmailAutocomplete
│   │   └── professor/         # ModuloCard
│   └── lib/
│       ├── auth.ts            # NextAuth + Google OAuth + papel por domínio
│       ├── db.ts              # Prisma singleton
│       ├── notas.ts           # Fórmulas de cálculo de notas
│       ├── criterios.ts       # Critérios de avaliação (1.x e 2.x)
│       └── validations.ts     # Schemas Zod
├── .env.example               # Modelo de variáveis de ambiente
└── .env.local                 # Suas credenciais (nunca commite!)
```

---

## 🔐 Papéis e acesso

| Domínio de email | Papel | Acesso |
|---|---|---|
| `prof.cesupa.br` | **TUTOR** | Cria módulos, lança notas, vê relatórios |
| `aluno.cesupa.br` | **ALUNO** | Faz auto-avaliação e avaliação interpares |

O papel é atribuído **automaticamente** no primeiro login pelo Google. Não é necessária intervenção manual no banco.

---

## 🧮 Fórmulas implementadas

Fórmulas migradas do Google Sheets (`src/lib/notas.ts`):

| Função | Fórmula |
|--------|---------|
| Nota do encontro | `(Prof×4 + Inter×0,5 + Auto×0,5) / (4 + 0,5_se_inter + 0,5_se_auto)` |
| M-At Tutor | `média(C1,C2,C3) - Atitudes` (ou SATISFATÓRIO) |
| M-At Aluno | `média(C1,C2,C3) - Atitudes` |
| Nota formativa | `min(média_Ab + média_Fe, 10)` |

---

## 🔄 Funcionalidades especiais

**Co-tutor / Substituto:** professor titular adiciona substituto com permissões granulares por problema e tipo de encontro.

**Encontros Especiais:** professor redistribui alunos para outras tutorias do mesmo módulo. Notas calculadas automaticamente na nota formativa do módulo de origem.

---

## 🚀 Deploy (Vercel + Neon)

```bash
git add .
git commit -m "deploy"
git push origin main
```

**Variáveis obrigatórias na Vercel:**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL           → https://tutoriaavalia.vercel.app
DATABASE_URL           → URL pooled do Neon
DIRECT_DATABASE_URL    → URL direta do Neon
ALLOWED_EMAIL_DOMAIN   → prof.cesupa.br,aluno.cesupa.br
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
| `Can't reach database server` | Verifique `DATABASE_URL` ou restaure o projeto no Neon |
| Loop de redirecionamento | Limpe os cookies do browser |
| `NEXTAUTH_SECRET is not set` | Execute `openssl rand -base64 32` |
| Papel errado após login | Faça logout e login novamente (papel atualiza a cada login) |

---

*© 2025 Jackson Lima — CESUPA. Sistema desenvolvido para uso acadêmico interno.*
