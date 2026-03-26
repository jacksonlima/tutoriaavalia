/**
 * API de login de desenvolvimento
 * POST /api/dev/login  (form body: email=xxx)
 *
 * Usa o provider 'dev-login' do NextAuth para criar a sessão corretamente.
 * Só funciona em NODE_ENV=development.
 */

import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  // Bloqueia em produção
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Não disponível' }, { status: 404 })
  }

  const body  = await req.formData()
  const email = (body.get('email') as string ?? '').trim().toLowerCase()

  if (!email) {
    return NextResponse.redirect(new URL('/dev/login', req.url))
  }

  try {
    // signIn com o provider 'dev-login' — gera cookie JWE correto via NextAuth
    await signIn('dev-login', { email, redirect: false })
  } catch (error: any) {
    // NextAuth lança NEXT_REDIRECT como "erro" quando redirect:false e funciona
    // Deixamos passar — o cookie já foi setado
    if (error?.message !== 'NEXT_REDIRECT' && !String(error).includes('NEXT_REDIRECT')) {
      console.error('[dev/login]', error?.message ?? error)
      return NextResponse.redirect(
        new URL('/dev/login?error=falha', req.url)
      )
    }
  }

  // Busca papel para redirecionar para o dashboard certo
  const usuario = await prisma.usuario.findUnique({
    where:  { email },
    select: { papel: true },
  })

  const destino = usuario?.papel === 'TUTOR'
    ? '/professor/dashboard'
    : '/aluno/dashboard'

  return NextResponse.redirect(new URL(destino, req.url))
}
