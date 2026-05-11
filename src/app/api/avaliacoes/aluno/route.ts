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
 *     → verifica encontro ativo, verifica Submissao prévia
 *     → usa UPSERT para AvaliacaoAluno (evita P2002)
 *     → cria Submissao ao final (trava real)
 *     → dispara notificações para tutor titular e co-tutores
 *
 *   CASO ESPECIAL — TARDIO INCOMPLETO:
 *     → euSouOTardio && jaSubmeteu
 *     → upsert das avaliações que faltam SEM criar nova Submissao
 *     → dispara notificações normalmente
 *
 *   FIND-NEW-02: GET retorna `encontroAtivo` para bloquear formulário no frontend.
 *   P2002 FIX: AvaliacaoAluno usa sempre upsert — trava garantida pelo Submissao.
 */

import { auth }               from '@/lib/auth'
import { avaliacaoAlunoSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Helper: upsert de AvaliacaoAluno (nunca falha por P2002) ─────────────────
async function upsertAvaliacao(
  tx:           any,
  problemaId:   string,
  avaliadorId:  string,
  tipoEncontro: string,
  av:           { avaliadoId: string; c1: number; c2: number; c3: number; atitudes: number },
) {
  return tx.avaliacaoAluno.upsert({
    where: {
      problemaId_avaliadorId_avaliadoId_tipoEncontro: {
        problemaId,
        avaliadorId,
        avaliadoId:   av.avaliadoId,
        tipoEncontro: tipoEncontro as any,
      },
    },
    create: {
      problemaId,
      avaliadorId,
      avaliadoId:   av.avaliadoId,
      tipoEncontro: tipoEncontro as any,
      c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
    },
    update: {
      c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
    },
  })
}

// ── Helper: cria notificações após submissão ──────────────────────────────────
// Melhor esforço — falha NÃO reverte a submissão (chamado com .catch())
async function criarNotificacoes(
  prisma: any,
  params: {
    alunoNome:      string
    problemaId:     string
    tipoEncontro:   string
    problemaNumero: number
    moduloId:       string
    moduloNome:     string
    moduloTutoria:  string
    moduloTutorId:  string
  }
) {
  const tipoLabel: Record<string, string> = {
    ABERTURA:     'Abertura',
    FECHAMENTO:   'Fechamento',
    FECHAMENTO_A: 'Fechamento A (Salto Triplo)',
    FECHAMENTO_B: 'Fechamento B (Salto Triplo)',
  }

  const titulo   = `Nova avaliação — P${params.problemaNumero} ${tipoLabel[params.tipoEncontro] ?? params.tipoEncontro}`
  const mensagem = `${params.alunoNome} enviou as avaliações de ${tipoLabel[params.tipoEncontro] ?? params.tipoEncontro} do Problema ${params.problemaNumero} — ${params.moduloNome} (${params.moduloTutoria}).`

  // Coleta IDs dos tutores a notificar (sem duplicatas)
  const tutorIds = new Set<string>()
  tutorIds.add(params.moduloTutorId)

  // Co-tutores com permissão para este problema + tipoEncontro
  // Nota: CoTutorPermissao tem tutorId diretamente (sem relação aninhada)
  const perms = await prisma.coTutorPermissao.findMany({
    where:  { problemaId: params.problemaId, tipoEncontro: params.tipoEncontro },
    select: { tutorId: true },
  })
  for (const p of perms) tutorIds.add(p.tutorId)

  if (tutorIds.size === 0) return

  // Notificacao usa usuarioId (não tutorId) — corrigido em relação ao código original
  await prisma.notificacao.createMany({
    data: Array.from(tutorIds).map((usuarioId) => ({
      usuarioId,
      moduloId: params.moduloId,
      tipo:     'AVALIACAO_ALUNO',
      titulo,
      mensagem,
      lida:     false,
    })),
    skipDuplicates: true,
  })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session || session?.user?.papel !== 'ALUNO') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body   = await req.json()
  const result = avaliacaoAlunoSchema.safeParse(body)
  if (!result.success) {
    console.error('[avaliacoes/aluno] Zod error:', JSON.stringify(result.error.flatten()))
    console.error('[avaliacoes/aluno] body:', JSON.stringify(body))
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data
  const userId = session?.user?.id!

  // Busca problema com dados do módulo para notificações
  const problema = await prisma.problema.findUnique({
    where:  { id: problemaId },
    select: {
      numero:           true,
      aberturaAtiva:    true,
      fechamentoAtivo:  true,
      fechamentoAAtivo: true,
      fechamentoBAtivo: true,
      modulo: {
        select: {
          id:      true,
          nome:    true,
          tutoria: true,
          tutorId: true,
        },
      },
    },
  })

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

  // Parâmetros de notificação (reutilizado em múltiplos caminhos)
  const notifParams = {
    alunoNome:      session?.user?.nome ?? '',
    problemaId,
    tipoEncontro,
    problemaNumero: problema.numero,
    moduloId:       problema.modulo.id,
    moduloNome:     problema.modulo.nome,
    moduloTutoria:  problema.modulo.tutoria,
    moduloTutorId:  problema.modulo.tutorId,
  }

  // ── MODO COMPLEMENTAR ───────────────────────────────────────────────────────
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

    await prisma.$transaction(async (tx: any) => {
      for (const av of avaliacoes) {
        await upsertAvaliacao(tx, problemaId, userId, tipoEncontro, av)
      }
    })

    // Notifica tutor sobre avaliação complementar
    criarNotificacoes(prisma, notifParams).catch((e) =>
      console.error('[notificacao] erro complementar:', e)
    )

    return NextResponse.json({
      sucesso: true, travado: false, modoComplementar: true, euSouOTardio: false,
    })
  }

  // ── MODO NORMAL / TARDIO ────────────────────────────────────────────────────
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

  // ── TARDIO INCOMPLETO: submeteu mas tem avaliações faltando ────────────────
  if (jaSubmeteu && euSouOTardio) {
    await prisma.$transaction(async (tx: any) => {
      for (const av of avaliacoes) {
        await upsertAvaliacao(tx, problemaId, userId, tipoEncontro, av)
      }
    })

    // Notifica tutor sobre complemento de avaliação
    criarNotificacoes(prisma, notifParams).catch((e) =>
      console.error('[notificacao] erro tardio:', e)
    )

    return NextResponse.json({
      sucesso: true, travado: true, modoComplementar: false,
      euSouOTardio: true, tardioComplementou: true,
    })
  }

  // ── Bloqueia submissão duplicada (alunos normais) ───────────────────────────
  if (jaSubmeteu) {
    return NextResponse.json(
      { error: 'Você já enviou esta avaliação. Não é possível alterar após o envio.' },
      { status: 409 },
    )
  }

  // ── PRIMEIRA SUBMISSÃO ──────────────────────────────────────────────────────
  const ipOrigem  = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'
  const userAgent = req.headers.get('user-agent') ?? ''

  await prisma.$transaction(async (tx: any) => {
    for (const av of avaliacoes) {
      await upsertAvaliacao(tx, problemaId, userId, tipoEncontro, av)
    }
    await tx.submissao.create({
      data: {
        problemaId,
        avaliadorId:  userId,
        tipoEncontro: tipoEncontro as any,
        ipOrigem,
        userAgent,
      },
    })
  })

  // Notifica tutor e co-tutores — melhor esforço, não reverte submissão
  criarNotificacoes(prisma, notifParams).catch((e) =>
    console.error('[notificacao] erro:', e)
  )

  return NextResponse.json({
    sucesso: true, travado: true, modoComplementar: false, euSouOTardio,
  })
}

// ── GET ────────────────────────────────────────────────────────────────────────
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
    encontroAtivo,
    janelasAbertas: modoComplementar ? janelasAbertas : [],
    modoComplementar,
    euSouOTardio,
  })
}
