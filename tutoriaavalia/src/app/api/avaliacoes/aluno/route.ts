/**
 * TutoriaAvalia v2 — Sistema de Avaliação Formativa para ABP
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/avaliacoes/aluno
 * Salva avaliações do aluno e trava definitivamente (imutável após submissão).
 * Após salvar, cria notificações para o tutor titular e co-tutores com permissão.
 *
 * Regras de notificação:
 * - Sempre notifica o tutor do módulo ao qual o problema pertence.
 * - Notifica co-tutores que tenham permissão para aquele problema + tipoEncontro.
 * - Situações Excepcionais: o aluno submete no problema do módulo DESTINO,
 *   logo o tutor destino é notificado automaticamente pela regra acima.
 */

import { auth } from '@/lib/auth'
import { avaliacaoAlunoSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Helper: cria notificações após submissão ──────────────────────────────

async function criarNotificacoes(
  prisma: any,
  params: {
    alunoNome:      string
    problemaId:     string
    tipoEncontro:   string
    problemaNumero: number
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

  // Co-tutores com permissão para este problema + tipo
  const perms = await prisma.coTutorPermissao.findMany({
    where:   { problemaId: params.problemaId, tipoEncontro: params.tipoEncontro },
    include: { coTutor: { select: { tutorId: true } } },
  })
  for (const p of perms) tutorIds.add(p.coTutor.tutorId)

  if (tutorIds.size === 0) return

  await prisma.notificacao.createMany({
    data: Array.from(tutorIds).map((tutorId) => ({
      tutorId,
      titulo,
      mensagem,
      problemaId:  params.problemaId,
      tipoEncontro: params.tipoEncontro,
    })),
  })
}

// ── POST — Submissão ──────────────────────────────────────────────────────

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
          ativo:     true,
          arquivado: true,
          nome:      true,
          tutoria:   true,
          tutorId:   true,
          matriculas: { where: { usuarioId: session?.user?.id }, select: { id: true } },
        },
      },
    },
  })

  if (!problema) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  if (!problema.modulo.ativo || problema.modulo.arquivado) {
    return NextResponse.json({ error: 'Este módulo não está ativo.' }, { status: 403 })
  }

  const estaMatriculado = problema.modulo.matriculas.length > 0
  const estaVisitando   = !estaMatriculado
    ? await prisma.situacaoExcepcional.findFirst({
        where: { alunoId: session?.user?.id, problemaDestinoId: problemaId, tipoEncontro },
      })
    : null

  if (!estaMatriculado && !estaVisitando) {
    return NextResponse.json(
      { error: 'Você não está matriculado nem foi alocado para este encontro.' },
      { status: 403 }
    )
  }

  const ativacaoPorTipo: Record<string, boolean> = {
    ABERTURA:     problema.aberturaAtiva,
    FECHAMENTO:   problema.fechamentoAtivo,
    FECHAMENTO_A: problema.fechamentoAAtivo,
    FECHAMENTO_B: problema.fechamentoBAtivo,
  }
  if (!(ativacaoPorTipo[tipoEncontro] ?? false)) {
    return NextResponse.json(
      { error: 'Este encontro ainda não foi aberto pelo professor. Aguarde a liberação.' },
      { status: 403 }
    )
  }

  const jaSubmeteu = await prisma.submissao.findUnique({
    where: {
      problemaId_avaliadorId_tipoEncontro: { problemaId, avaliadorId: session?.user?.id, tipoEncontro },
    },
  })
  if (jaSubmeteu) {
    return NextResponse.json(
      { error: 'Você já enviou esta avaliação. Não é possível alterar após o envio.' },
      { status: 409 }
    )
  }

  const ipOrigem  = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'
  const userAgent = req.headers.get('user-agent') ?? ''

  await prisma.$transaction(async (tx: any) => {
    for (const av of avaliacoes) {
      // upsert: cria se não existe, atualiza se já havia registro parcial anterior
      await tx.avaliacaoAluno.upsert({
        where: {
          problemaId_avaliadorId_avaliadoId_tipoEncontro: {
            problemaId,
            avaliadorId: session?.user?.id,
            avaliadoId:  av.avaliadoId,
            tipoEncontro,
          },
        },
        update: { c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes },
        create: {
          problemaId,
          avaliadorId: session?.user?.id,
          avaliadoId:  av.avaliadoId,
          tipoEncontro,
          c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes,
        },
      })
    }
    await tx.submissao.create({
      data: { problemaId, avaliadorId: session?.user?.id, tipoEncontro, ipOrigem, userAgent },
    })
  })

  // Notificações: melhor esforço — falha não reverte a submissão
  criarNotificacoes(prisma, {
    alunoNome:      session?.user?.nome,
    problemaId,
    tipoEncontro,
    problemaNumero: problema.numero,
    moduloNome:     problema.modulo.nome,
    moduloTutoria:  problema.modulo.tutoria,
    moduloTutorId:  problema.modulo.tutorId,
  }).catch((e) => console.error('[notificacao] erro:', e))

  return NextResponse.json({ sucesso: true, travado: true })
}

// ── GET — Avaliações do aluno logado ─────────────────────────────────────

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

  const submetido = await prisma.submissao.findUnique({
    where: {
      problemaId_avaliadorId_tipoEncontro: { problemaId, avaliadorId: session?.user?.id, tipoEncontro },
    },
  })

  const avaliacoes = await prisma.avaliacaoAluno.findMany({
    where:   { problemaId, avaliadorId: session?.user?.id, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
  })

  return NextResponse.json({ avaliacoes, submetido: !!submetido })
}
