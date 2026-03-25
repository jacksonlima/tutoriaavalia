import { auth } from '@/lib/auth'
import { avaliacaoAlunoSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/avaliacoes/aluno
// Salva as avaliações E trava definitivamente (imutável após submissão)
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'ALUNO') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const result = avaliacaoAlunoSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  // ── Verificação de acesso do aluno ────────────────────────────────────────
  // A ÚNICA condição que controla acesso é o campo de ativação do encontro
  // (aberturaAtiva, fechamentoAtivo, etc.) no registro do Problema.
  // Isso é independente do professor ter salvo ou não as notas dele.
  // O professor NÃO bloqueia o aluno ao salvar notas — ele só libera/fecha
  // o encontro usando o toggle no painel.
  const problema = await prisma.problema.findUnique({
    where:  { id: problemaId },
    select: {
      aberturaAtiva:    true,
      fechamentoAtivo:  true,
      fechamentoAAtivo: true,
      fechamentoBAtivo: true,
      modulo: {
        select: {
          ativo:     true,
          arquivado: true,
          matriculas: { where: { usuarioId: session.user.id }, select: { id: true } },
        },
      },
    },
  })

  if (!problema) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  // Módulo precisa estar ativo e não arquivado
  if (!problema.modulo.ativo || problema.modulo.arquivado) {
    return NextResponse.json({ error: 'Este módulo não está ativo.' }, { status: 403 })
  }

  // Verifica se o aluno pertence ao grupo: matriculado OU visitante via EncontroEspecial
  const estaMatriculado = problema.modulo.matriculas.length > 0
  const estaVisitando   = !estaMatriculado
    ? await prisma.encontroEspecial.findFirst({
        where: {
          alunoId:           session.user.id,
          problemaDestinoId: problemaId,
          tipoEncontro:      tipoEncontro,
        },
      })
    : null

  if (!estaMatriculado && !estaVisitando) {
    return NextResponse.json(
      { error: 'Você não está matriculado nem foi alocado para este encontro.' },
      { status: 403 }
    )
  }

  // Mapeia cada tipo de encontro para seu campo de ativação no banco
  const ativacaoPorTipo: Record<string, boolean> = {
    ABERTURA:     problema.aberturaAtiva,
    FECHAMENTO:   problema.fechamentoAtivo,
    FECHAMENTO_A: problema.fechamentoAAtivo,
    FECHAMENTO_B: problema.fechamentoBAtivo,
  }
  const encontroAtivo = ativacaoPorTipo[tipoEncontro] ?? false

  if (!encontroAtivo) {
    return NextResponse.json(
      { error: 'Este encontro ainda não foi aberto pelo professor. Aguarde a liberação.' },
      { status: 403 }
    )
  }

  // Verifica se já submeteu — TRAVAMENTO REAL
  const jaSubmeteu = await prisma.submissao.findUnique({
    where: {
      problemaId_avaliadorId_tipoEncontro: {
        problemaId,
        avaliadorId: session.user.id,
        tipoEncontro,
      },
    },
  })
  if (jaSubmeteu) {
    return NextResponse.json(
      { error: 'Você já enviou esta avaliação. Não é possível alterar após o envio.' },
      { status: 409 }
    )
  }

  // Salva avaliações + registra submissão em transação atômica
  const ipOrigem =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'desconhecido'
  const userAgent = req.headers.get('user-agent') ?? ''

  await prisma.$transaction(async (tx) => {
    // Insere todas as avaliações individuais
    for (const av of avaliacoes) {
      await tx.avaliacaoAluno.create({
        data: {
          problemaId,
          avaliadorId: session.user.id,
          avaliadoId: av.avaliadoId,
          tipoEncontro,
          c1: av.c1,
          c2: av.c2,
          c3: av.c3,
          atitudes: av.atitudes,
        },
      })
    }

    // Registra a submissão — isso TRAVA o formulário
    await tx.submissao.create({
      data: {
        problemaId,
        avaliadorId: session.user.id,
        tipoEncontro,
        ipOrigem,
        userAgent,
      },
    })
  })

  return NextResponse.json({ sucesso: true, travado: true })
}

// GET /api/avaliacoes/aluno?problemaId=X&tipoEncontro=ABERTURA
// Retorna as avaliações do aluno logado (somente leitura após submissão)
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const problemaId = searchParams.get('problemaId')
  const tipoEncontro = searchParams.get('tipoEncontro') as 'ABERTURA' | 'FECHAMENTO' | 'FECHAMENTO_A' | 'FECHAMENTO_B' | null

  if (!problemaId || !tipoEncontro) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
  }

  const submetido = await prisma.submissao.findUnique({
    where: {
      problemaId_avaliadorId_tipoEncontro: {
        problemaId,
        avaliadorId: session.user.id,
        tipoEncontro,
      },
    },
  })

  const avaliacoes = await prisma.avaliacaoAluno.findMany({
    where: { problemaId, avaliadorId: session.user.id, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
  })

  return NextResponse.json({ avaliacoes, submetido: !!submetido })
}
