/**
 * TutoriaAvalia v2 — Sistema de Avaliação Formativa para ABP
 * Autor: Jackson Lima — CESUPA
 *
 * GET  /api/notificacoes              — lista notificações do tutor logado
 * PATCH /api/notificacoes             — marca todas como lidas
 * PATCH /api/notificacoes?id=X        — marca uma específica como lida
 */

import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET — retorna notificações não lidas (máx. 50) + total não lidas
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const mostrarLidas = searchParams.get('todas') === 'true'

  const where = {
    usuarioId: session?.user?.id,
    ...(mostrarLidas ? {} : { lida: false }),
  }

  const [notificacoes, totalNaoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where,
      orderBy: { criadaEm: 'desc' },
      take:    50,
    }),
    prisma.notificacao.count({ where: { usuarioId: session?.user?.id, lida: false } }),
  ])

  return NextResponse.json({ notificacoes, totalNaoLidas })
}

// PATCH — marca como lida (uma ou todas)
export async function PATCH(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    // Marca uma notificação específica (garante que pertence ao tutor)
    await prisma.notificacao.updateMany({
      where: { id, usuarioId: session?.user?.id },
      data:  { lida: true },
    })
  } else {
    // Marca todas como lidas
    await prisma.notificacao.updateMany({
      where: { usuarioId: session?.user?.id, lida: false },
      data:  { lida: true },
    })
  }

  return NextResponse.json({ ok: true })
}
