import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { Papel } from '@prisma/client'

// Lê os domínios permitidos do .env.local
// Aceita um ou mais domínios separados por vírgula:
//   Um domínio:  ALLOWED_EMAIL_DOMAIN=prof.cesupa.br
//   Múltiplos:   ALLOWED_EMAIL_DOMAIN=prof.cesupa.br,gmail.com
// Se vazio ou ausente, QUALQUER email Google é aceito (útil para testes locais)
const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAIN ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Provider de desenvolvimento — só funciona quando NODE_ENV=development
    // Permite logar com qualquer email sem Google OAuth, para testes locais.
    // Em produção este provider é ignorado (retorna null).
    ...(process.env.NODE_ENV === 'development'
      ? [
          Credentials({
            id:   'dev-login',
            name: 'Dev Login',
            credentials: {
              email: { label: 'Email', type: 'text' },
            },
            async authorize(credentials) {
              const email = (credentials?.email as string ?? '').trim().toLowerCase()
              if (!email) return null

              // Busca o usuário no banco — não cria, apenas autentica quem já existe
              const usuario = await prisma.usuario.findUnique({
                where:  { email },
                select: { id: true, email: true, nome: true, papel: true },
              })

              if (!usuario) return null

              // Retorna no formato que o NextAuth espera para o objeto User
              return {
                id:    usuario.id,
                email: usuario.email,
                name:  usuario.nome,
                image: null,
              }
            },
          }),
        ]
      : []),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    // ── signIn ──────────────────────────────────────────────────────
    // Chamado logo após o Google autenticar.
    // Retorna true → prossegue. Retorna false → mostra AccessDenied.
    async signIn({ user, account }) {
      if (!user.email) return false

      // Verifica domínio APENAS se ALLOWED_EMAIL_DOMAIN estiver configurado
      if (allowedDomains.length > 0) {
        const emailDomain = (user.email.split('@')[1] ?? '').toLowerCase()
        if (!allowedDomains.includes(emailDomain)) {
          console.warn(
            `[auth] Login bloqueado: ${user.email} — domínios permitidos: ${allowedDomains.join(', ')}`
          )
          return false
        }
      }

      // Cria ou atualiza o usuário na tabela 'usuarios'
      try {
        await prisma.usuario.upsert({
          where:  { email: user.email },
          update: {
            nome:      user.name      ?? user.email.split('@')[0],
            avatarUrl: user.image     ?? null,
            googleSub: account?.providerAccountId ?? null,
          },
          create: {
            email:     user.email,
            nome:      user.name      ?? user.email.split('@')[0],
            papel:     Papel.ALUNO, // padrão: ALUNO. Tutor é definido via seed/Prisma Studio.
            avatarUrl: user.image     ?? null,
            googleSub: account?.providerAccountId ?? null,
          },
        })
        return true
      } catch (err) {
        console.error('[auth] Erro ao salvar usuário no banco:', err)
        return false
      }
    },

    // ── jwt ─────────────────────────────────────────────────────────
    // Chamado em toda requisição autenticada para construir/renovar o token.
    // Busca o papel no banco APENAS quando o token ainda não tem papel.
    async jwt({ token }) {
      // Token já completo → devolve sem query no banco
      if (token.id && token.papel) return token

      // Token incompleto → busca papel pelo email
      if (!token.email) return token

      try {
        const dbUser = await prisma.usuario.findUnique({
          where:  { email: token.email as string },
          select: { id: true, papel: true, nome: true },
        })
        if (dbUser) {
          token.id    = dbUser.id
          token.papel = dbUser.papel
          token.nome  = dbUser.nome
        }
      } catch (err) {
        // Banco indisponível — devolve token sem papel.
        // O middleware trata esse caso (deixa passar sem redirecionar).
        console.error('[auth] Erro ao buscar papel no banco:', err)
      }

      return token
    },

    // ── session ─────────────────────────────────────────────────────
    // Expõe os campos do token na sessão acessível pelo cliente React.
    async session({ session, token }) {
      if (session.user) {
        session.user.id    = (token.id    as string) ?? ''
        session.user.papel = (token.papel as Papel)  ?? null
        session.user.nome  = (token.nome  as string) ?? session.user.name ?? ''
        session.user.email = (token.email as string) ?? ''
      }
      return session
    },
  },
})

// Extensão de tipos: adiciona os campos customizados à Session do NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id:     string
      email:  string
      nome:   string
      papel:  Papel | null
      name?:  string | null
      image?: string | null
    }
  }
}
