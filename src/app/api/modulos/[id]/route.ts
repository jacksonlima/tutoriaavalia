/**
 * Notas da Tutoria v2 — API: Módulo por ID
 * Autor: Jackson Lima — CESUPA
 *
 * GET    → carrega módulo para edição
 * PATCH  → arquiva ({ acao: 'arquivar' }) ou exclui ({ acao: 'excluir' })
 * DELETE → exclui módulo arquivado via tela de arquivados (cascade)
 */
import { auth }        from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Função auxiliar: exclusão em cascata ──────────────────────────────────────
async function excluirModuloCascata(prisma: any, moduloId: string) {
  const problemas = await prisma.problema.findMany({
    where:  { moduloId },
    select: { id: true },
  })
  const probIds = problemas.map((p: any) => p.id)

  if (probIds.length > 0) {
    await prisma.avaliacaoAluno.deleteMany({ where: { problemaId: { in: probIds } } })
    await prisma.avaliacaoTutor.deleteMany({ where: { problemaId: { in: probIds } } })
    await prisma.submissao.deleteMany({ where: { problemaId: { in: probIds } } })
    await prisma.janelaComplementar.deleteMany({ where: { problemaId: { in: probIds } } })
    await prisma.situacaoExcepcional.deleteMany({ where: { problemaDestinoId: { in: probIds } } })
  }

  await prisma.situacaoExcepcional.deleteMany({ where: { moduloOrigemId: moduloId } })
  await prisma.coTutorPermissao.deleteMany({ where: { moduloId } })
  await prisma.notificacao.deleteMany({ where: { moduloId } })
  await prisma.problema.deleteMany({ where: { moduloId } })
  await prisma.matricula.deleteMany({ where: { moduloId } })
  await prisma.modulo.delete({ where: { id: moduloId } })
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()

  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id: moduloId } = await context.params
  const userId = session?.user?.id!

  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, nome: true, email: true } } },
        orderBy:  { numeraNaTurma: 'asc' },
      },
      _count: { select: { matriculas: true } },
    },
  })

  if (!modulo)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  if (modulo.tutorId !== userId) {
    const permissao = await prisma.coTutorPermissao.findFirst({
      where: { moduloId, tutorId: userId },
    })
    if (!permissao)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  return NextResponse.json(modulo)
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Body: { acao: 'arquivar' } | { acao: 'excluir' }
export async function PATCH(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()

  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id: moduloId } = await context.params
  const userId = session?.user?.id!
  const body   = await req.json()
  const acao   = body?.acao as string | undefined

  const modulo = await prisma.modulo.findUnique({
    where:  { id: moduloId },
    select: { id: true, tutorId: true, arquivado: true, nome: true },
  })

  if (!modulo)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  if (modulo.tutorId !== userId)
    return NextResponse.json({ error: 'Acesso restrito: você não é o titular deste módulo' }, { status: 403 })

  // ── Arquivar ─────────────────────────────────────────────────────────────
  if (acao === 'arquivar') {
    await prisma.modulo.update({
      where: { id: moduloId },
      data:  { arquivado: true },
    })
    return NextResponse.json({ ok: true, arquivado: true })
  }

  // ── Excluir ──────────────────────────────────────────────────────────────
  if (acao === 'excluir') {
    // Verifica se há avaliações lançadas (proteção para módulos com dados)
    const problemas = await prisma.problema.findMany({
      where:  { moduloId },
      select: { id: true },
    })
    const probIds = problemas.map((p: any) => p.id)

    const temAvaliacoes = probIds.length > 0 && await prisma.avaliacaoTutor.count({
      where: { problemaId: { in: probIds } },
    }) > 0

    if (temAvaliacoes) {
      return NextResponse.json(
        {
          error: 'Este módulo possui avaliações lançadas e não pode ser excluído diretamente. Arquive-o primeiro.',
          temAvaliacoes: true,
        },
        { status: 409 }
      )
    }

    await excluirModuloCascata(prisma, moduloId)
    return NextResponse.json({ ok: true, excluido: true, moduloId })
  }

  // Suporte legado: { arquivado: boolean }
  if (typeof body?.arquivado === 'boolean') {
    await prisma.modulo.update({
      where: { id: moduloId },
      data:  { arquivado: body.arquivado },
    })
    return NextResponse.json({ ok: true, arquivado: body.arquivado })
  }

  return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// Usado pela tela de arquivados (DeleteModuloButton) — só módulos arquivados
export async function DELETE(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()

  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id: moduloId } = await context.params
  const userId = session?.user?.id!

  const modulo = await prisma.modulo.findUnique({
    where:  { id: moduloId },
    select: { id: true, tutorId: true, arquivado: true, nome: true },
  })

  if (!modulo)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  if (modulo.tutorId !== userId)
    return NextResponse.json({ error: 'Você não tem permissão para excluir este módulo' }, { status: 403 })

  if (!modulo.arquivado)
    return NextResponse.json(
      { error: 'Apenas módulos arquivados podem ser excluídos. Arquive o módulo primeiro.' },
      { status: 400 }
    )

  await excluirModuloCascata(prisma, moduloId)
  return NextResponse.json({ ok: true, moduloId, nome: modulo.nome })
}
