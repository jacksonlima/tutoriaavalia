import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────
// GET /api/encontros-especiais?moduloId=X
// Lista todas as realocações do módulo (Professor A vê onde cada aluno foi)
// ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const moduloId = new URL(req.url).searchParams.get('moduloId')
  if (!moduloId) return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  const encontros = await prisma.situacaoExcepcional.findMany({
    where:   { moduloOrigemId: moduloId },
    include: {
      aluno: { select: { id: true, nome: true, email: true } },
      problemaDestino: {
        include: {
          modulo: {
            select: {
              id:       true,
              nome:     true,
              tutoria:  true,
              turma:    true,
              tutor:    { select: { nome: true } },
            },
          },
        },
      },
    },
    orderBy: [{ aluno: { nome: 'asc' } }, { tipoEncontro: 'asc' }],
  })

  return NextResponse.json(encontros)
}

// ─────────────────────────────────────────────────────────────────
// POST /api/encontros-especiais
// Cria ou atualiza realocações. Suporta múltiplos alunos → múltiplos destinos.
// Body: {
//   moduloOrigemId: string,
//   observacao?: string,   // motivo geral (ex: "Falta do Prof A — 15/04")
//   alocacoes: Array<{
//     alunoId:           string,
//     problemaDestinoId: string,
//     tipoEncontro:      string,
//   }>
// }
// ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { moduloOrigemId, observacao, alocacoes } = await req.json()

  if (!moduloOrigemId || !Array.isArray(alocacoes) || alocacoes.length === 0)
    return NextResponse.json(
      { error: 'moduloOrigemId e alocacoes (array) são obrigatórios' },
      { status: 400 }
    )

  // Verifica propriedade do módulo de origem
  const moduloOrigem = await prisma.modulo.findUnique({
    where:   { id: moduloOrigemId },
    include: { matriculas: { select: { usuarioId: true } } },
  })
  if (!moduloOrigem || moduloOrigem.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  const alunosDoModulo = new Set(moduloOrigem.matriculas.map((m) => m.usuarioId))

  // Valida cada alocação
  for (const a of alocacoes) {
    if (!a.alunoId || !a.problemaDestinoId || !a.tipoEncontro)
      return NextResponse.json(
        { error: 'Cada alocação precisa de: alunoId, problemaDestinoId, tipoEncontro' },
        { status: 400 }
      )
    if (!alunosDoModulo.has(a.alunoId))
      return NextResponse.json(
        { error: `Aluno ${a.alunoId} não está matriculado no módulo de origem` },
        { status: 400 }
      )
  }

  // Verifica duplicatas na própria requisição
  // (mesmo aluno + mesmo tipoEncontro aparecendo duas vezes = erro)
  const chaves = alocacoes.map((a) => `${a.alunoId}|${a.tipoEncontro}`)
  const chavesUnicas = new Set(chaves)
  if (chaves.length !== chavesUnicas.size)
    return NextResponse.json(
      { error: 'O mesmo aluno não pode ter dois destinos para o mesmo tipo de encontro' },
      { status: 400 }
    )

  // Upsert: cria ou atualiza cada alocação
  const criados = []
  for (const a of alocacoes) {
    const ee = await prisma.situacaoExcepcional.upsert({
      where: {
        alunoId_moduloOrigemId_tipoEncontro: {
          alunoId:        a.alunoId,
          moduloOrigemId,
          tipoEncontro:   a.tipoEncontro,
        },
      },
      update: {
        problemaDestinoId: a.problemaDestinoId,
        observacao:        observacao ?? null,
      },
      create: {
        alunoId:           a.alunoId,
        moduloOrigemId,
        problemaDestinoId: a.problemaDestinoId,
        tipoEncontro:      a.tipoEncontro,
        observacao:        observacao ?? null,
      },
      include: {
        aluno: { select: { id: true, nome: true, email: true } },
        problemaDestino: {
          include: {
            modulo: { select: { nome: true, tutoria: true, turma: true, tutor: { select: { nome: true } } } },
          },
        },
      },
    })
    criados.push(ee)
  }

  return NextResponse.json(criados)
}

// ─────────────────────────────────────────────────────────────────
// DELETE /api/encontros-especiais
// Body: { situacaoExcepcionalId } — remove uma realocação específica
// ─────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { situacaoExcepcionalId } = await req.json()
  if (!situacaoExcepcionalId)
    return NextResponse.json({ error: 'situacaoExcepcionalId obrigatório' }, { status: 400 })

  const ee = await prisma.situacaoExcepcional.findUnique({
    where:   { id: situacaoExcepcionalId },
    include: { moduloOrigem: { select: { tutorId: true } } },
  })
  if (!ee || ee.moduloOrigem.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.situacaoExcepcional.delete({ where: { id: situacaoExcepcionalId } })
  return NextResponse.json({ ok: true })
}
