/**
 * Notas da Tutoria v2 — API: Avaliações do Aluno
 * Autor: Jackson Lima — CESUPA
 *
 * REGRAS:
 *   MODO COMPLEMENTAR: upsert + notifica; não cria Submissao
 *   MODO NORMAL:       upsert + Submissao + notifica
 *   TARDIO INCOMPLETO: upsert sem nova Submissao + notifica
 *   FIND-NEW-02:       GET retorna encontroAtivo
 *   P2002 FIX:         AvaliacaoAluno sempre via upsert
 *
 *   BLOQUEIO RETROATIVO (novo):
 *     Alunos que ingressaram no módulo APÓS um encontro já concluído
 *     não podem submeter avaliações desse encontro.
 *     Detectado por: algum colega submeteu ANTES da data de matrícula do aluno.
 *     Exceção: euSouOTardio=true (janela complementar legítima) não é bloqueado.
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
        problemaId, avaliadorId, avaliadoId: av.avaliadoId, tipoEncontro: tipoEncontro as any,
      },
    },
    create: {
      problemaId, avaliadorId, avaliadoId: av.avaliadoId,
      tipoEncontro: tipoEncontro as any,
      c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
    },
    update: { c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes },
  })
}

// ── Helper: cria notificações após submissão ──────────────────────────────────
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

  const tutorIds = new Set<string>()
  tutorIds.add(params.moduloTutorId)

  const perms = await prisma.coTutorPermissao.findMany({
    where:  { problemaId: params.problemaId, tipoEncontro: params.tipoEncontro },
    select: { tutorId: true },
  })
  for (const p of perms) tutorIds.add(p.tutorId)

  if (tutorIds.size === 0) return

  for (const tutorId of tutorIds) {
    await prisma.$executeRaw`
      INSERT INTO notificacoes
        (id, tutor_id, usuario_id, modulo_id, tipo, titulo, mensagem, lida)
      VALUES
        (gen_random_uuid()::text, ${tutorId}, ${tutorId}, ${params.moduloId},
         'AVALIACAO_ALUNO', ${titulo}, ${mensagem}, false)
    `
  }
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

  const problema = await prisma.problema.findUnique({
    where:  { id: problemaId },
    select: {
      numero:           true,
      aberturaAtiva:    true,
      fechamentoAtivo:  true,
      fechamentoAAtivo: true,
      fechamentoBAtivo: true,
      modulo: {
        select: { id: true, nome: true, tutoria: true, tutorId: true },
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

  // ── TARDIO INCOMPLETO ───────────────────────────────────────────────────────
  if (jaSubmeteu && euSouOTardio) {
    await prisma.$transaction(async (tx: any) => {
      for (const av of avaliacoes) {
        await upsertAvaliacao(tx, problemaId, userId, tipoEncontro, av)
      }
    })

    criarNotificacoes(prisma, notifParams).catch((e) =>
      console.error('[notificacao] erro tardio:', e)
    )

    return NextResponse.json({
      sucesso: true, travado: true, modoComplementar: false,
      euSouOTardio: true, tardioComplementou: true,
    })
  }

  // ── Bloqueia duplicata (alunos normais) ─────────────────────────────────────
  if (jaSubmeteu) {
    return NextResponse.json(
      { error: 'Você já enviou esta avaliação. Não é possível alterar após o envio.' },
      { status: 409 },
    )
  }

  // ── BLOQUEIO RETROATIVO ─────────────────────────────────────────────────────
  // Impede que alunos que ingressaram APÓS um encontro já concluído
  // submetam avaliações retroativamente.
  //
  // Lógica: se algum colega submeteu ANTES da data de matrícula deste aluno
  // → o encontro aconteceu antes do aluno entrar no grupo → bloqueado.
  //
  // Exceção: euSouOTardio=true (janela complementar legítima) não é bloqueado —
  // o tardio tem janela aberta exatamente para participar de um encontro em andamento.
  if (!euSouOTardio) {
    const matriculaDoAluno = await prisma.matricula.findUnique({
      where:  { moduloId_usuarioId: { moduloId: problema.modulo.id, usuarioId: userId } },
      select: { criadoEm: true },
    })

    if (matriculaDoAluno) {
      // Verifica se algum colega submeteu ANTES do aluno ser matriculado
      const submissaoAnteriorAoIngresso = await prisma.submissao.findFirst({
        where: {
          problemaId,
          tipoEncontro: tipoEncontro as any,
          avaliadorId:  { not: userId },
          submetidoEm:  { lt: matriculaDoAluno.criadoEm },
        },
        select: { id: true },
      })

      if (submissaoAnteriorAoIngresso) {
        return NextResponse.json(
          {
            error: 'Este encontro foi concluído antes da sua entrada no grupo. Avaliações de encontros anteriores ao seu ingresso não são permitidas.',
          },
          { status: 403 },
        )
      }
    }
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
