import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')

  // Tenta via cookie (web normal)
  const session = await auth()
  if (session?.user?.email) {
    const usuario = await prisma.usuario.findUnique({
      where:  { email: session.user.email },
      select: { id: true, nome: true, email: true, papel: true, avatarUrl: true },
    })
    if (usuario) return NextResponse.json(usuario)
  }

  // Tenta via Bearer token (app mobile)
  const authHeader = req.headers.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null

  if (bearerToken) {
    // Busca a sessão pelo token diretamente no banco
    const dbSession = await prisma.session.findUnique({
      where:   { sessionToken: bearerToken },
      include: { user: { select: { id: true, nome: true, email: true, papel: true, avatarUrl: true } } },
    })

    if (dbSession && dbSession.expires > new Date()) {
      return NextResponse.json(dbSession.user)
    }
  }

  return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
}
