/**
 * TutoriaAvalia v2 — API: Avaliações do Aluno (interpares + auto-avaliação)
 * Autor: Jackson Lima — CESUPA
 *
 * REGRA DE JANELA COMPLEMENTAR:
 *
 *   Quando uma JanelaComplementar está aberta para aluno X:
 *
 *   • Outros alunos → modo COMPLEMENTAR: só podem avaliar X (não alteram notas já enviadas)
 *   • Aluno X (tardio) → modo NORMAL: vê todos os colegas, submete normalmente
 *
 *   O aluno tardio nunca entra em modo complementar — ele é o alvo, não o avaliador restrito.
 */

import { auth }               from '@/lib/auth'
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
  const userId = session?.user?.id!

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

  // ── Janelas abertas para este problema/encontro ───────────────────────────
  const janelasAbertas = await prisma.janelaComplementar.findMany({
    where:  { problemaId, tipoEncontro: tipoEncontro as any, aberta: true },
    select: { alunoId: true },
  })

  const idsJanelasAbertas = new Set(janelasAbertas.map((j) => j.alunoId))

  // O aluno logado É o aluno tardio? Se sim → modo normal (não complementar)
  // O modo complementar só se aplica a quem está avaliando o tardio, não ao tardio em si
  const euSouOTardio     = idsJanelasAbertas.has(userId)
  const emModoComplementar = janelasAbertas.length > 0 && !euSouOTardio

  if (emModoComplementar) {
    // Modo complementar: só aceita avaliações do(s) aluno(s) das janelas abertas
    const idsEnviados        = new Set(avaliacoes.map((a) => a.avaliadoId))
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
    // Em modo complementar o encontro pode estar "fechado" — a janela sobrepõe
  } else {
    // Modo normal (titular ou aluno tardio): verifica encontro ativo
    if (!encontroAtivo) {
      return NextResponse.json(
        { error: 'Este encontro ainda não foi aberto pelo professor.' },
        { status: 403 },
      )
    }

    // Verifica submissão prévia (trava total — exceto aluno tardio que nunca submeteu)
    const jaSubmeteu = await prisma.submissao.findUnique({
      where: {
        problemaId_avaliadorId_tipoEncontro: {
          problemaId,
          avaliadorId:  userId,
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

  const ipOrigem  = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'
  const userAgent = req.headers.get('user-agent') ?? ''

  await prisma.$transaction(async (tx) => {
    for (const av of avaliacoes) {
      if (emModoComplementar) {
        // Complementar: upsert (permite criar sem ter submetido antes)
        await tx.avaliacaoAluno.upsert({
          where: {
            problemaId_avaliadorId_avaliadoId_tipoEncontro: {
              problemaId,
              avaliadorId:  userId,
              avaliadoId:   av.avaliadoId,
              tipoEncontro: tipoEncontro as any,
            },
          },
          create: {
            problemaId,
            avaliadorId:  userId,
            avaliadoId:   av.avaliadoId,
            tipoEncontro: tipoEncontro as any,
            c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
          },
          update: {
            c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
          },
        })
      } else {
        // Normal (inclui aluno tardio): create imutável
        await tx.avaliacaoAluno.create({
          data: {
            problemaId,
            avaliadorId:  userId,
            avaliadoId:   av.avaliadoId,
            tipoEncontro: tipoEncontro as any,
            c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
          },
        })
      }
    }

    if (!emModoComplementar) {
      // Registra submissão (trava) — vale para o aluno tardio também
      await tx.submissao.create({
        data: {
          problemaId,
          avaliadorId:  userId,
          tipoEncontro: tipoEncontro as any,
          ipOrigem,
          userAgent,
        },
      })
    }
  })

  return NextResponse.json({
    sucesso:          true,
    travado:          !emModoComplementar,
    modoComplementar: emModoComplementar,
    euSouOTardio,
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

  const userId = session?.user?.id!

  const [submetido, avaliacoes, janelasAbertas] = await Promise.all([
    prisma.submissao.findUnique({
      where: {
        problemaId_avaliadorId_tipoEncontro: {
          problemaId,
          avaliadorId:  userId,
          tipoEncontro: tipoEncontro as any,
        },
      },
    }),
    prisma.avaliacaoAluno.findMany({
      where:   { problemaId, avaliadorId: userId, tipoEncontro: tipoEncontro as any },
      include: { avaliado: { select: { id: true, nome: true } } },
    }),
    prisma.janelaComplementar.findMany({
      where:   { problemaId, tipoEncontro: tipoEncontro as any, aberta: true },
      include: { aluno: { select: { id: true, nome: true } } },
    }),
  ])

  const idsJanelas   = new Set(janelasAbertas.map((j) => j.alunoId))
  const euSouOTardio = idsJanelas.has(userId)

  // Aluno tardio recebe modoComplementar=false → página mostra todos os colegas
  const modoComplementar = janelasAbertas.length > 0 && !euSouOTardio

  return NextResponse.json({
    avaliacoes,
    submetido:        !!submetido,
    janelasAbertas:   modoComplementar ? janelasAbertas : [], // tardio não recebe janelas
    modoComplementar,
    euSouOTardio,
  })
}
