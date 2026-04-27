/**
 * TutoriaAvalia v2 — API: Avaliações do Aluno (interpares + auto-avaliação)
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/avaliacoes/aluno
 *   Salva as avaliações E trava definitivamente (imutável após submissão).
 *
 *   REGRA DE JANELA COMPLEMENTAR:
 *   Se existe uma JanelaComplementar aberta para este problema/encontro,
 *   o aluno só pode avaliar o aluno-alvo da janela — não pode modificar
 *   avaliações já submetidas para outros colegas.
 *
 * GET /api/avaliacoes/aluno?problemaId=X&tipoEncontro=Y
 *   Retorna avaliações do aluno logado + status de janelas abertas.
 */

import { auth }         from '@/lib/auth'
import { avaliacaoAlunoSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session || session?.user?.papel !== 'ALUNO') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body   = await req.json()
  const result = avaliacaoAlunoSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  // Verifica se o encontro existe e está ativo
  const problema = await prisma.problema.findUnique({ where: { id: problemaId } })
  if (!problema) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  const campoAtivo: Record<string, boolean> = {
    ABERTURA:     problema.aberturaAtiva,
    FECHAMENTO:   problema.fechamentoAtivo,
    FECHAMENTO_A: (problema as any).fechamentoAAtivo ?? false,
    FECHAMENTO_B: (problema as any).fechamentoBAtivo ?? false,
  }
  const encontroAtivo = campoAtivo[tipoEncontro] ?? false

  // ── JANELAS COMPLEMENTARES ────────────────────────────────────────────────
  // Verifica se há alguma janela aberta para este encontro.
  const janelasAbertas = await prisma.janelaComplementar.findMany({
    where: { problemaId, tipoEncontro: tipoEncontro as any, aberta: true },
    select: { alunoId: true },
  })
  const emModoComplementar = janelasAbertas.length > 0
  const idsJanelasAbertas  = new Set(janelasAbertas.map((j) => j.alunoId))

  if (emModoComplementar) {
    // MODO COMPLEMENTAR: só aceita avaliações dos alunos das janelas abertas
    const idsEnviados = new Set(avaliacoes.map((a) => a.avaliadoId))
    const avaliadosInvalidos = [...idsEnviados].filter((id) => !idsJanelasAbertas.has(id))

    if (avaliadosInvalidos.length > 0) {
      return NextResponse.json(
        {
          error: 'Há uma janela complementar aberta. Neste momento você só pode avaliar o(s) aluno(s) da janela.',
          modoComplementar: true,
          idsPermitidos: [...idsJanelasAbertas],
        },
        { status: 409 },
      )
    }

    // Em modo complementar, o encontro pode estar "fechado" mas a janela sobrepõe
    // (o professor já avaliou o encontro normal — agora é só o aluno tardio)
    // Não exige encontroAtivo para processar avaliações complementares.
  } else {
    // MODO NORMAL: verifica se o encontro está ativo
    if (!encontroAtivo) {
      return NextResponse.json(
        { error: 'Este encontro ainda não foi aberto pelo professor.' },
        { status: 403 },
      )
    }

    // Em modo normal, verifica submissão prévia (trava total)
    const jaSubmeteu = await prisma.submissao.findUnique({
      where: {
        problemaId_avaliadorId_tipoEncontro: {
          problemaId,
          avaliadorId: session?.user?.id!,
          tipoEncontro: tipoEncontro as any,
        },
      },
    })
    if (jaSubmeteu) {
      return NextResponse.json(
        { error: 'Você já enviou esta avaliação. Não é possível alterar após o envio.' },
        { status: 409 },
      )
    }
  }

  // ── Metadados da requisição ───────────────────────────────────────────────
  const ipOrigem =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip')       ??
    'desconhecido'
  const userAgent = req.headers.get('user-agent') ?? ''

  // ── Transação: salva avaliações + submissão ───────────────────────────────
  await prisma.$transaction(async (tx) => {
    for (const av of avaliacoes) {
      if (emModoComplementar) {
        // Em modo complementar: usa upsert (permite criar sem ter submetido antes)
        await tx.avaliacaoAluno.upsert({
          where: {
            problemaId_avaliadorId_avaliadoId_tipoEncontro: {
              problemaId,
              avaliadorId: session?.user?.id!,
              avaliadoId:  av.avaliadoId,
              tipoEncontro: tipoEncontro as any,
            },
          },
          create: {
            problemaId,
            avaliadorId: session?.user?.id!,
            avaliadoId:  av.avaliadoId,
            tipoEncontro: tipoEncontro as any,
            c1:       av.c1,
            c2:       av.c2,
            c3:       av.c3,
            atitudes: av.atitudes,
          },
          update: {
            // Complementar pode ser atualizado enquanto janela estiver aberta
            c1:       av.c1,
            c2:       av.c2,
            c3:       av.c3,
            atitudes: av.atitudes,
          },
        })
      } else {
        // Modo normal: create (único, imutável)
        await tx.avaliacaoAluno.create({
          data: {
            problemaId,
            avaliadorId: session?.user?.id!,
            avaliadoId:  av.avaliadoId,
            tipoEncontro: tipoEncontro as any,
            c1:       av.c1,
            c2:       av.c2,
            c3:       av.c3,
            atitudes: av.atitudes,
          },
        })
      }
    }

    if (!emModoComplementar) {
      // Modo normal: registra submissão (trava o formulário para sempre)
      await tx.submissao.create({
        data: {
          problemaId,
          avaliadorId: session?.user?.id!,
          tipoEncontro: tipoEncontro as any,
          ipOrigem,
          userAgent,
        },
      })
    }
    // Em modo complementar NÃO cria Submissao —
    // isso garante que o aluno ainda possa fazer a avaliação normal
    // quando o professor reabrir o encontro no futuro.
  })

  return NextResponse.json({
    sucesso:          true,
    travado:          !emModoComplementar,
    modoComplementar: emModoComplementar,
  })
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const problemaId   = searchParams.get('problemaId')
  const tipoEncontro = searchParams.get('tipoEncontro') as string | null

  if (!problemaId || !tipoEncontro) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
  }

  const [submetido, avaliacoes, janelasAbertas] = await Promise.all([
    prisma.submissao.findUnique({
      where: {
        problemaId_avaliadorId_tipoEncontro: {
          problemaId,
          avaliadorId:  session?.user?.id!,
          tipoEncontro: tipoEncontro as any,
        },
      },
    }),
    prisma.avaliacaoAluno.findMany({
      where:   { problemaId, avaliadorId: session?.user?.id!, tipoEncontro: tipoEncontro as any },
      include: { avaliado: { select: { id: true, nome: true } } },
    }),
    prisma.janelaComplementar.findMany({
      where:   { problemaId, tipoEncontro: tipoEncontro as any, aberta: true },
      include: { aluno: { select: { id: true, nome: true } } },
    }),
  ])

  return NextResponse.json({
    avaliacoes,
    submetido:        !!submetido,
    janelasAbertas,
    modoComplementar: janelasAbertas.length > 0,
  })
}
