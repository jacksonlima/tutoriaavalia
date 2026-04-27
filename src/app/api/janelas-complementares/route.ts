/**
 * TutoriaAvalia v2 — API: Janelas de Avaliação Complementar
 * Autor: Jackson Lima — CESUPA
 *
 * GET  /api/janelas-complementares?problemaId=X&tipoEncontro=Y
 *   → Lista janelas abertas (usada por alunos ao entrar na tela de avaliação)
 *
 * POST /api/janelas-complementares
 *   → Professor cria uma janela para um aluno tardio
 *   → Também matricula o aluno no módulo, se ainda não estiver
 */

import { auth }          from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── GET ──────────────────────────────────────────────────────────────────────
// Retorna janelas abertas para um problema/encontro.
// Usada pelos alunos para saber se há avaliação complementar pendente.
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const problemaId   = searchParams.get('problemaId')
  const tipoEncontro = searchParams.get('tipoEncontro') as string | null

  if (!problemaId || !tipoEncontro) {
    return NextResponse.json(
      { error: 'problemaId e tipoEncontro são obrigatórios' },
      { status: 400 },
    )
  }

  const janelas = await prisma.janelaComplementar.findMany({
    where: {
      problemaId,
      tipoEncontro: tipoEncontro as any,
      aberta: true,
    },
    include: {
      aluno: { select: { id: true, nome: true, email: true } },
    },
    orderBy: { criadaEm: 'desc' },
  })

  return NextResponse.json({ janelas })
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Professor cria uma janela de avaliação complementar para aluno tardio.
// Fluxo:
//   1. Valida que o chamador é TUTOR do módulo
//   2. Matricula o aluno no módulo (se necessário)
//   3. Cria a JanelaComplementar (ou reabre se já existia fechada)
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const { problemaId, alunoId, tipoEncontro } = body

  if (!problemaId || !alunoId || !tipoEncontro) {
    return NextResponse.json(
      { error: 'problemaId, alunoId e tipoEncontro são obrigatórios' },
      { status: 400 },
    )
  }

  // Busca o problema para checar se o encontro está ativo e pegar o moduloId
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: { select: { id: true, tutorId: true } } },
  })

  if (!problema) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  // Só o tutor titular pode abrir janelas
  if (problema.modulo.tutorId !== session?.user?.id) {
    return NextResponse.json(
      { error: 'Apenas o tutor titular pode abrir janelas complementares' },
      { status: 403 },
    )
  }

  // Verifica se o aluno existe e tem papel ALUNO
  const aluno = await prisma.usuario.findUnique({ where: { id: alunoId } })
  if (!aluno || aluno.papel !== 'ALUNO') {
    return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
  }

  const moduloId = problema.modulo.id

  // Conta alunos já matriculados para gerar o número na turma
  const totalMatriculados = await prisma.matricula.count({ where: { moduloId } })

  // Usa transação para garantir atomicidade: matricula + janela
  const resultado = await prisma.$transaction(async (tx) => {
    // 1. Matricula o aluno se ainda não estiver no módulo
    let matricula = await tx.matricula.findUnique({
      where: { moduloId_usuarioId: { moduloId, usuarioId: alunoId } },
    })

    if (!matricula) {
      matricula = await tx.matricula.create({
        data: {
          moduloId,
          usuarioId:     alunoId,
          numeraNaTurma: totalMatriculados + 1,
        },
      })
    }

    // 2. Cria ou reabre a janela complementar
    const janela = await tx.janelaComplementar.upsert({
      where:  { problemaId_alunoId_tipoEncontro: { problemaId, alunoId, tipoEncontro } },
      create: {
        problemaId,
        alunoId,
        tipoEncontro,
        criadaPorId: session?.user?.id!,
        aberta:      true,
      },
      update: {
        // Reabre se estava fechada
        aberta:    true,
        fechadaEm: null,
      },
      include: {
        aluno: { select: { id: true, nome: true } },
      },
    })

    return { janela, matriculaNova: !matricula.id }
  })

  return NextResponse.json({
    sucesso:       true,
    janela:        resultado.janela,
    matriculaNova: resultado.matriculaNova,
    mensagem:      `Janela aberta para ${aluno.nome}. Os colegas podem avaliá-lo agora.`,
  })
}
