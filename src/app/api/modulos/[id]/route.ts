/**
 * Notas da Tutoria v2 — API: Módulo por ID
 * Autor: Jackson Lima — CESUPA
 *
 * GET    /api/modulos/[id] — carrega dados do módulo para edição
 * DELETE /api/modulos/[id] — exclui módulo arquivado e todos os seus dados
 */
import { auth }        from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── GET — carrega módulo para a página de edição ──────────────────────────────
export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()

  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id: moduloId } = await context.params
  const userId = session?.user?.id!

  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    include: {
      problemas: { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, nome: true, email: true } } },
        orderBy:  { numeraNaTurma: 'asc' },
      },
      _count: { select: { matriculas: true } },
    },
  })

  if (!modulo) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  // Verifica acesso: titular ou co-tutor
  if (modulo.tutorId !== userId) {
    const permissao = await prisma.coTutorPermissao.findFirst({
      where: { moduloId, tutorId: userId },
    })
    if (!permissao) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  return NextResponse.json(modulo)
}

// ── DELETE — exclui módulo arquivado e todos os seus dados ────────────────────
export async function DELETE(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()

  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id: moduloId } = await context.params
  const userId = session?.user?.id!

  const modulo = await prisma.modulo.findUnique({
    where:  { id: moduloId },
    select: { id: true, tutorId: true, arquivado: true, nome: true },
  })

  if (!modulo) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  if (modulo.tutorId !== userId) {
    return NextResponse.json(
      { error: 'Você não tem permissão para excluir este módulo' },
      { status: 403 }
    )
  }

  if (!modulo.arquivado) {
    return NextResponse.json(
      { error: 'Apenas módulos arquivados podem ser excluídos. Arquive o módulo primeiro.' },
      { status: 400 }
    )
  }

  await prisma.$transaction(async (tx) => {
    const problemas = await tx.problema.findMany({
      where:  { moduloId },
      select: { id: true },
    })
    const probIds = problemas.map((p) => p.id)

    if (probIds.length > 0) {
      await tx.avaliacaoAluno.deleteMany({ where: { problemaId: { in: probIds } } })
      await tx.avaliacaoTutor.deleteMany({ where: { problemaId: { in: probIds } } })
      await tx.submissao.deleteMany({ where: { problemaId: { in: probIds } } })
      await tx.janelaComplementar.deleteMany({ where: { problemaId: { in: probIds } } })
      await tx.situacaoExcepcional.deleteMany({ where: { problemaDestinoId: { in: probIds } } })
    }

    await tx.situacaoExcepcional.deleteMany({ where: { moduloOrigemId: moduloId } })
    await tx.coTutorPermissao.deleteMany({ where: { moduloId } })
    await tx.notificacao.deleteMany({ where: { moduloId } })
    await tx.problema.deleteMany({ where: { moduloId } })
    await tx.matricula.deleteMany({ where: { moduloId } })
    await tx.modulo.delete({ where: { id: moduloId } })
  })

  return NextResponse.json({ ok: true, moduloId, nome: modulo.nome })
}
