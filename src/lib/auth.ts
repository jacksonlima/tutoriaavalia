/**
 * TutoriaAvalia v2
 * Autor: Jackson Lima — CESUPA
 * Sistema de avaliação formativa para Aprendizagem Baseada em Problemas (ABP)
 */
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { Papel } from '@prisma/client'

// Lê os domínios permitidos diretamente em runtime (não em cache de módulo)
const getAllowedDomains = () =>
  (process.env.ALLOWED_EMAIL_DOMAIN ?? '')
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
    ...(process.env.NODE_ENV === 'development'
      ? [
          Credentials({
            id:   'dev-login',
            name: 'Dev Login',
            credentials: {
              email: { label: 'Email', type: 'text' },
            },
            async authorize(credentials) {
              const email = ((credentials?.email as string) ?? '').trim().toLowerCase()
              if (!email) return null

              // Import dinâmico — nunca executado durante o build
              const { prisma } = await import('@/lib/db')
              const usuario = await prisma.usuario.findUnique({
                where:  { email },
                select: { id: true, email: true, nome: true, papel: true },
              })

              if (!usuario) return null
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
    // Chamado após o Google autenticar. Salva o usuário no banco.
    async signIn({ user, account }) {
      // LOG DETALHADO — ajuda a depurar problemas de login em produção
      console.log('[auth][signIn] email recebido do Google:', user.email)
      console.log('[auth][signIn] ALLOWED_EMAIL_DOMAIN:', process.env.ALLOWED_EMAIL_DOMAIN ?? '(vazio)')

      if (!user.email) {
        console.error('[auth][signIn] BLOQUEADO — email vazio')
        return false
      }

      // Verifica domínio
      const allowedDomains = getAllowedDomains()
      console.log('[auth][signIn] domínios permitidos:', allowedDomains)

      if (allowedDomains.length > 0) {
        const emailDomain = (user.email.split('@')[1] ?? '').toLowerCase()
        console.log('[auth][signIn] domínio do email:', emailDomain)
        if (!allowedDomains.includes(emailDomain)) {
          console.error(`[auth][signIn] BLOQUEADO — domínio '${emailDomain}' não está em [${allowedDomains.join(', ')}]`)
          return false
        }
      } else {
        console.log('[auth][signIn] sem restrição de domínio — qualquer email aceito')
      }

      // Determina papel pelo domínio: prof.cesupa.br → TUTOR, demais → ALUNO
      const dominio      = (user.email.split('@')[1] ?? '').toLowerCase()
      const papelInicial = dominio === 'prof.cesupa.br' ? Papel.TUTOR : Papel.ALUNO
      console.log(`[auth][signIn] domínio=${dominio} → papel=${papelInicial}`)

      // Salva no banco (erro não bloqueia o login)
      try {
        const { prisma } = await import('@/lib/db')
        await prisma.usuario.upsert({
          where:  { email: user.email },
          update: {
            nome:      user.name      ?? user.email.split('@')[0],
            avatarUrl: user.image     ?? null,
            googleSub: account?.providerAccountId ?? null,
            papel:     papelInicial,
          },
          create: {
            email:     user.email,
            nome:      user.name      ?? user.email.split('@')[0],
            papel:     papelInicial,
            avatarUrl: user.image     ?? null,
            googleSub: account?.providerAccountId ?? null,
          },
        })
        console.log('[auth][signIn] usuário salvo no banco:', user.email)
      } catch (err) {
        console.error('[auth][signIn] erro ao salvar no banco (não bloqueia login):', err)
      }

      console.log('[auth][signIn] APROVADO:', user.email)
      return true
    },

    // Constrói o JWT com os dados do usuário do banco
    async jwt({ token }) {
      if (token.id && token.papel) return token
      if (!token.email) return token

      try {
        const { prisma } = await import('@/lib/db')
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
        console.error('[auth] Erro ao buscar papel no banco:', err)
      }

      return token
    },

    // Expõe os campos do token na sessão do cliente
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

// Extensão de tipos para a Session do NextAuth
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
