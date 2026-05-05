/**
 * TutoriaAvalia v2 — API: Avaliações do Aluno (interpares + auto-avaliação)
 * Autor: Jackson Lima — CESUPA
 *
 * REGRAS:
 *
 *   MODO COMPLEMENTAR (janela aberta, aluno não é o tardio):
 *     → só avalia o(s) aluno(s) da janela; upsert livre; não cria Submissao
 *
 *   MODO NORMAL / TARDIO (primeira submissão):
 *     → verifica encontro ativo, verifica Submissao prévia, create + Submissao
 *
 *   CASO ESPECIAL — TARDIO INCOMPLETO:
 *     → euSouOTardio && jaSubmeteu (submeteu incompleto antes do bug ser corrigido)
 *     → upsert das avaliações que faltam SEM criar nova Submissao
 *
 *   FIND-NEW-02: GET agora retorna `encontroAtivo` para que o frontend
 *     possa bloquear a renderização do formulário se o encontro estiver fechado.
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

  const janelasAbertas = await prisma.janelaComplementar.findMany({
    where:  { problemaId, tipoEncontro: tipoEncontro as any, aberta: true },
    select: { alunoId: true },
  })

  const idsJanelasAbertas  = new Set(janelasAbertas.map((j) => j.alunoId))
  const euSouOTardio       = idsJanelasAbertas.has(userId)
  const emModoComplementar = janelasAbertas.length > 0 && !euSouOTardio

  // ── MODO COMPLEMENTAR ─────────────────────────────────────────────────────
  if (emModoComplementar) {
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

    await prisma.$transaction(async (tx) => {
      for (const av of avaliacoes) {
        await tx.avaliacaoAluno.upsert({
          where: {
            problemaId_avaliadorId_avaliadoId_tipoEncontro: {
              problemaId, avaliadorId: userId,
              avaliadoId: av.avaliadoId, tipoEncontro: tipoEncontro as any,
            },
          },
          create: {
            problemaId, avaliadorId: userId, avaliadoId: av.avaliadoId,
            tipoEncontro: tipoEncontro as any,
            c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
          },
          update: { c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes },
        })
      }
    })

    return NextResponse.json({
      sucesso: true, travado: false, modoComplementar: true, euSouOTardio: false,
    })
  }

  // ── MODO NORMAL / TARDIO ──────────────────────────────────────────────────
  if (!encontroAtivo) {
    return NextResponse.json(
      { error: 'Este encontro ainda não foi aberto pelo professor.' },
      { status: 403 },
    )
  }

  const jaSubmeteu = await prisma.submissao.findUnique({
    where: {
      problemaId_avaliadorId_tipoEncontro: {
        problemaId, avaliadorId: userId, tipoEncontro: tipoEncontro as any,
      },
    },
  })

  // ── CASO ESPECIAL: tardio com submissão incompleta ────────────────────────
  if (jaSubmeteu && euSouOTardio) {
    await prisma.$transaction(async (tx) => {
      for (const av of avaliacoes) {
        await tx.avaliacaoAluno.upsert({
          where: {
            problemaId_avaliadorId_avaliadoId_tipoEncontro: {
              problemaId, avaliadorId: userId,
              avaliadoId: av.avaliadoId, tipoEncontro: tipoEncontro as any,
            },
          },
          create: {
            problemaId, avaliadorId: userId, avaliadoId: av.avaliadoId,
            tipoEncontro: tipoEncontro as any,
            c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
          },
          update: { c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes },
        })
      }
    })

    return NextResponse.json({
      sucesso: true, travado: true, modoComplementar: false,
      euSouOTardio: true, tardioComplementou: true,
    })
  }

  if (jaSubmeteu) {
    return NextResponse.json(
      { error: 'Você já enviou esta avaliação. Não é possível alterar após o envio.' },
      { status: 409 },
    )
  }

  const ipOrigem  = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'
  const userAgent = req.headers.get('user-agent') ?? ''

  await prisma.$transaction(async (tx) => {
    for (const av of avaliacoes) {
      await tx.avaliacaoAluno.create({
        data: {
          problemaId, avaliadorId: userId, avaliadoId: av.avaliadoId,
          tipoEncontro: tipoEncontro as any,
          c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
        },
      })
    }
    await tx.submissao.create({
      data: {
        problemaId, avaliadorId: userId,
        tipoEncontro: tipoEncontro as any,
        ipOrigem, userAgent,
      },
    })
  })

  return NextResponse.json({
    sucesso: true, travado: true, modoComplementar: false, euSouOTardio,
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

  const [problema, submetido, avaliacoes, janelasAbertas] = await Promise.all([
    // FIND-NEW-02: busca o problema para verificar se o encontro está ativo
    prisma.problema.findUnique({
      where:  { id: problemaId },
      select: {
        aberturaAtiva:    true,
        fechamentoAtivo:  true,
        fechamentoAAtivo: true,
        fechamentoBAtivo: true,
      },
    }),
    prisma.submissao.findUnique({
      where: {
        problemaId_avaliadorId_tipoEncontro: {
          problemaId, avaliadorId: userId, tipoEncontro: tipoEncontro as any,
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

  // FIND-NEW-02: calcula se o encontro está ativo para este tipoEncontro
  const campoAtivo: Record<string, boolean> = {
    ABERTURA:     problema?.aberturaAtiva    ?? false,
    FECHAMENTO:   problema?.fechamentoAtivo  ?? false,
    FECHAMENTO_A: problema?.fechamentoAAtivo ?? false,
    FECHAMENTO_B: problema?.fechamentoBAtivo ?? false,
  }
  const encontroAtivo = campoAtivo[tipoEncontro] ?? false

  const idsJanelas       = new Set(janelasAbertas.map((j) => j.alunoId))
  const euSouOTardio     = idsJanelas.has(userId)
  const modoComplementar = janelasAbertas.length > 0 && !euSouOTardio

  return NextResponse.json({
    avaliacoes,
    submetido:      !!submetido,
    encontroAtivo,  // FIND-NEW-02: frontend usa para bloquear renderização
    janelasAbertas: modoComplementar ? janelasAbertas : [],
    modoComplementar,
    euSouOTardio,
  })
}
