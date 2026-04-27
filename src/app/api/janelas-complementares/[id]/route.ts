/**
 * TutoriaAvalia v2 — API: Gerenciar Janela Complementar específica
 * Autor: Jackson Lima — CESUPA
 *
 * PATCH /api/janelas-complementares/[id]
 *   → Professor fecha ou reabre uma janela
 *
 * GET /api/janelas-complementares/[id]
 *   → Retorna detalhes de uma janela (incluindo quem já avaliou)
 */

import { auth }          from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params

  const janela = await prisma.janelaComplementar.findUnique({
    where: { id },
    include: {
      aluno:    { select: { id: true, nome: true, email: true } },
      problema: {
        include: {
          modulo: {
            include: {
              matriculas: {
                include: { usuario: { select: { id: true, nome: true } } },
                orderBy:  { numeraNaTurma: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  if (!janela) {
    return NextResponse.json({ error: 'Janela não encontrada' }, { status: 404 })
  }

  // Lista quem já avaliou o aluno tardio neste encontro
  const jaAvaliaram = await prisma.avaliacaoAluno.findMany({
    where: {
      problemaId:   janela.problemaId,
      avaliadoId:   janela.alunoId,
      tipoEncontro: janela.tipoEncontro,
    },
    include: { avaliador: { select: { id: true, nome: true } } },
  })

  // Alunos matriculados que ainda não avaliaram o aluno tardio
  const todosAlunos   = janela.problema.modulo.matriculas.map((m) => m.usuario)
  const idsQueAvaliaram = new Set(jaAvaliaram.map((a) => a.avaliadorId))
  const pendentes     = todosAlunos.filter(
    (a) => a.id !== janela.alunoId && !idsQueAvaliaram.has(a.id),
  )

  return NextResponse.json({
    janela,
    progresso: {
      total:        todosAlunos.length - 1, // exclui o próprio aluno tardio
      jaAvaliaram:  jaAvaliaram.length,
      pendentes:    pendentes.map((p) => p.nome),
    },
  })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Professor fecha ou reabre a janela
export async function PATCH(req: NextRequest, { params }: Params) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id }   = await params
  const { acao } = await req.json() // 'fechar' | 'reabrir'

  if (!['fechar', 'reabrir'].includes(acao)) {
    return NextResponse.json({ error: "acao deve ser 'fechar' ou 'reabrir'" }, { status: 400 })
  }

  const janela = await prisma.janelaComplementar.findUnique({
    where:   { id },
    include: { problema: { include: { modulo: true } } },
  })

  if (!janela) {
    return NextResponse.json({ error: 'Janela não encontrada' }, { status: 404 })
  }

  // Só o tutor do módulo pode fechar/reabrir
  if (janela.problema.modulo.tutorId !== session?.user?.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const atualizado = await prisma.janelaComplementar.update({
    where: { id },
    data:  {
      aberta:    acao === 'reabrir',
      fechadaEm: acao === 'fechar' ? new Date() : null,
    },
    include: { aluno: { select: { id: true, nome: true } } },
  })

  return NextResponse.json({
    sucesso: true,
    janela:  atualizado,
    mensagem: acao === 'fechar'
      ? `Janela fechada para ${atualizado.aluno.nome}. Avaliações complementares encerradas.`
      : `Janela reaberta para ${atualizado.aluno.nome}.`,
  })
}
