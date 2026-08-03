/**
 * Notas da Tutoria v2 — API: Módulo por ID
 * Autor: Jackson Lima — CESUPA
 *
 * DELETE /api/modulos/[id]
 * Exclui permanentemente um módulo ARQUIVADO e todos os seus dados.
 * Só o tutor titular pode excluir seu próprio módulo.
 * Só módulos arquivados podem ser excluídos (proteção extra).
 */
import { auth }        from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

  // Verifica se o módulo existe e pertence ao tutor
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

  // Exclui em cascata na ordem correta (respeita as foreign keys)
  await prisma.$transaction(async (tx) => {
    // Busca IDs dos problemas do módulo
    const problemas = await tx.problema.findMany({
      where:  { moduloId },
      select: { id: true },
    })
    const probIds = problemas.map((p) => p.id)

    if (probIds.length > 0) {
      // Avaliações dos alunos
      await tx.avaliacaoAluno.deleteMany({
        where: { problemaId: { in: probIds } },
      })
      // Avaliações dos tutores
      await tx.avaliacaoTutor.deleteMany({
        where: { problemaId: { in: probIds } },
      })
      // Submissões
      await tx.submissao.deleteMany({
        where: { problemaId: { in: probIds } },
      })
      // Janelas complementares
      await tx.janelaComplementar.deleteMany({
        where: { problemaId: { in: probIds } },
      })
      // Situações excepcionais (destino)
      await tx.situacaoExcepcional.deleteMany({
        where: { problemaDestinoId: { in: probIds } },
      })
    }

    // Situações excepcionais (origem)
    await tx.situacaoExcepcional.deleteMany({
      where: { moduloOrigemId: moduloId },
    })
    // Co-tutor permissões
    await tx.coTutorPermissao.deleteMany({
      where: { moduloId },
    })
    // Notificações
    await tx.notificacao.deleteMany({
      where: { moduloId },
    })
    // Problemas
    await tx.problema.deleteMany({
      where: { moduloId },
    })
    // Matrículas
    await tx.matricula.deleteMany({
      where: { moduloId },
    })
    // Módulo
    await tx.modulo.delete({
      where: { id: moduloId },
    })
  })

  return NextResponse.json({ ok: true, moduloId, nome: modulo.nome })
}
