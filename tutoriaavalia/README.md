# TutoriaAvalia v2

Sistema web de avaliação formativa para Aprendizagem Baseada em Problemas (ABP).  
Mobile-first · Login Google · Banco de dados PostgreSQL · Sem Google Drive ou Sheets.

---

## ⚡ Instalação Rápida (MacBook Pro 2017)

### Pré-requisitos (instalar uma vez)

**1. Homebrew**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**2. Node.js 20 e Git**
```bash
brew install node@20 git
```
Verifique: `node --version` deve mostrar `v20.x.x`

---

### Configurações externas necessárias

**3. Supabase (banco de dados gratuito)**
- Acesse [supabase.com](https://supabase.com) → *Start your project*
- Crie um projeto: nome `tutoriaavalia`, região *South America (São Paulo)*
- Anote a senha do banco
- Vá em **Settings → Database → Connection String (URI mode)**
- Copie a string e substitua `[YOUR-PASSWORD]` pela sua senha

**4. Google Cloud Console (autenticação)**
- Acesse [console.cloud.google.com](https://console.cloud.google.com)
- Crie um projeto chamado `tutoriaavalia`
- **APIs e serviços → Biblioteca → ative: "Google+ API"**
- **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth 2.0**
- Tipo: *Aplicativo da Web*
- URI de redirecionamento autorizado: `http://localhost:3000/api/auth/callback/google`
- Copie o **Client ID** e o **Client Secret**

---

### Instalação do projeto

**5. Baixar e instalar dependências**
```bash
cd ~/Documentos
git clone https://github.com/SEU_USUARIO/tutoriaavalia.git
cd tutoriaavalia
npm install
```

**6. Configurar variáveis de ambiente**
```bash
cp .env.example .env.local
```

Abra `.env.local` e preencha:
```env
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
NEXTAUTH_SECRET=   # gere com: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:SENHA@db.XXX.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:SENHA@db.XXX.supabase.co:5432/postgres
ALLOWED_EMAIL_DOMAIN=suainstituicao.edu.br
```

**7. Criar tabelas no banco**
```bash
npx prisma migrate dev --name init
```
Aguarde: *"Your database is now in sync with your schema"*

**8. Popular com dados de teste**
```bash
npm run db:seed
```

**9. Rodar o sistema**
```bash
npm run dev
```
Acesse: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Contas de teste (após seed)

| Email | Papel |
|-------|-------|
| `professor@suainstituicao.edu.br` | Professor (TUTOR) |
| `ana1@suainstituicao.edu.br` | Aluno |
| `bruno2@suainstituicao.edu.br` | Aluno |

> ⚠️ Ajuste os emails no arquivo `prisma/seed.ts` para seu domínio real.

---

## 📁 Estrutura do projeto

```
tutoriaavalia/
├── prisma/
│   ├── schema.prisma     # Modelo de dados completo
│   └── seed.ts           # Dados de teste
├── src/
│   ├── app/
│   │   ├── (auth)/login/ # Tela de login Google
│   │   ├── (professor)/  # Dashboard, criar módulo, avaliar, relatórios
│   │   ├── (aluno)/      # Dashboard e formulário de avaliação
│   │   └── api/          # API REST: modulos, problemas, avaliacoes, notas
│   ├── components/
│   │   ├── ui/           # TopBar, Toaster
│   │   └── professor/    # ModuloCard
│   └── lib/
│       ├── auth.ts       # NextAuth + Google OAuth
│       ├── db.ts         # Prisma singleton
│       ├── notas.ts      # Fórmulas migradas das planilhas
│       └── validations.ts # Schemas Zod
└── .env.local            # Suas credenciais (nunca commite!)
```

---

## 🧮 Fórmulas implementadas

Todas as fórmulas do Excel foram migradas para `src/lib/notas.ts`:

| Função | Equivale a |
|--------|-----------|
| `calcMedia(c1, c2, c3)` | `=AVERAGE(B4:D4)` |
| `calcMMenosAtTutor(...)` | `=IF(H4=TRUE,"SATISFATÓRIO",(E4-F4))` |
| `calcMMenosAtAluno(...)` | `=E4-F4` |
| `calcNotaEncontro(...)` | Fórmula principal do Formativa.xlsx col. B |
| `calcNotaFormativa(...)` | `=SUM(R4+S4)` do Resumo MT |

---

## 🚀 Deploy em produção (Vercel — gratuito)

```bash
npm install -g vercel
vercel
```
Siga o assistente. Adicione as variáveis do `.env.local` no painel da Vercel.  
Adicione `https://seu-projeto.vercel.app/api/auth/callback/google` nos URIs do Google Console.

---

## 🛠 Comandos úteis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run db:studio    # Interface visual do banco (Prisma Studio)
npm run db:migrate   # Aplicar migrações
npm run db:seed      # Recriar dados de teste
```

---

## 📱 Uso no celular (PWA)

1. Acesse a URL do sistema no Chrome do celular
2. Toque no menu (⋮) → "Adicionar à tela inicial"
3. O sistema instala como app nativo

---

## ❓ Problemas comuns

| Erro | Solução |
|------|---------|
| `Cannot find module '@prisma/client'` | Execute `npx prisma generate` |
| `P1001: Can't reach database server` | Verifique `DATABASE_URL` no `.env.local` |
| Login retorna "Acesso negado" | Verifique `ALLOWED_EMAIL_DOMAIN` e o domínio do seu email |
| `Error: NEXTAUTH_SECRET is not set` | Execute `openssl rand -base64 32` e cole no `.env.local` |
