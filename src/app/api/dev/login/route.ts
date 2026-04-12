/**
 * TutoriaAvalia v2 — API de login de desenvolvimento
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/dev/login  (form body: email=xxx)
 * Só funciona em NODE_ENV=development.
 *
 * IMPORTANTE: todos os redirects usam os headers x-forwarded-host/proto
 * para preservar o host real (funciona com localhost, IP local e ngrok).
 */

import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getBase(req: NextRequest): string {
  const forwardedHost  = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host           = req.headers.get('host') ?? 'localhost:3000'

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

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

  console.log(`[dev/login] → ${base}${destino}`)
  return NextResponse.redirect(`${base}${destino}`)
}
