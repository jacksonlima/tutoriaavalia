/**
 * TutoriaAvalia v2 — API de login de desenvolvimento
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/dev/login  (form body: email=xxx)
 * Só funciona em NODE_ENV=development.
 */

import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** 
 * Constrói a URL base usando os headers reais da requisição.
 * 
 * Quando o acesso vem via ngrok, os headers são:
 *   x-forwarded-host: abc123.ngrok-free.app
 *   x-forwarded-proto: https
 * 
 * Quando o acesso vem direto (localhost ou IP):
 *   host: localhost:3000 (ou 192.168.x.x:9000)
 *   x-forwarded-proto: ausente → usa http
 * 
 * Isso garante que o redirect use o host que o cliente realmente conhece.
 */
function getBase(req: NextRequest): string {
  const forwardedHost  = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host           = req.headers.get('host') ?? 'localhost:3000'

  // ngrok e proxies reversos definem x-forwarded-host
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  // Acesso direto — usa o host + protocolo da requisição interna
  const internalProto = req.url.startsWith('https') ? 'https' : 'http'
  return `${internalProto}://${host}`
}

export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Não disponível' }, { status: 404 })
  }

  const base  = getBase(req)
  const body  = await req.formData()
  const email = (body.get('email') as string ?? '').trim().toLowerCase()

  if (!email) {
    return NextResponse.redirect(`${base}/dev/login`)
  }

  try {
    await signIn('dev-login', { email, redirect: false })
  } catch (error: any) {
    if (error?.message !== 'NEXT_REDIRECT' && !String(error).includes('NEXT_REDIRECT')) {
      console.error('[dev/login]', error?.message ?? error)
      return NextResponse.redirect(`${base}/dev/login?error=falha`)
    }
  }

  const usuario = await prisma.usuario.findUnique({
    where:  { email },
    select: { papel: true },
  })

  const destino = usuario?.papel === 'TUTOR'
    ? '/professor/dashboard'
    : '/aluno/dashboard'

  console.log(`[dev/login] redirecionando para: ${base}${destino}`)
  return NextResponse.redirect(`${base}${destino}`)
}
