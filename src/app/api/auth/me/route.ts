/**
 * TutoriaAvalia v2 — GET /api/auth/me
 * Autor: Jackson Lima — CESUPA
 *
 * Retorna os dados do usuário logado.
 * Útil para verificar a sessão atual via fetch no cliente.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where:  { email: session.user.email },
    select: { id: true, nome: true, email: true, papel: true, avatarUrl: true },
  })

  if (!usuario) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  return NextResponse.json(usuario)
}
