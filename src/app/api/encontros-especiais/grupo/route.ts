/**
 * TutoriaAvalia v2 — GET /api/encontros-especiais/grupo?problemaId=X&tipoEncontro=Y
 *
 * Retorna o grupo efetivo para um encontro, incluindo alunos visitantes
 * realocados via Situação Excepcional.
 *
 * Para ALUNO — dois caminhos possíveis:
 *   A) problemaId = DESTINO (link com externo=1):
 *      O usuário já está em situacoesRecebidas → retorna grupo do destino diretamente
 *   B) problemaId = ORIGEM (link normal do dashboard):
 *      Busca SE onde moduloOrigemId = módulo da origem → redireciona para grupo destino
 *
 * Para TUTOR:
 *   Retorna matriculados + visitantes recebidos (com flag visitante: true)
 */
import { auth }                  from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url          = new URL(req.url)
  const problemaId   = url.searchParams.get('problemaId')
  const tipoEncontro = url.searchParams.get('tipoEncontro')

  if (!problemaId || !tipoEncontro)
    return NextResponse.json({ error: 'problemaId e tipoEncontro são obrigatórios' }, { status: 400 })

  // Carrega o problema com módulo e alunos matriculados
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
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
  })

  if (!problema)
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })

  const userId          = session.user?.id!
  const moduloId        = problema.modulo.id
  const alunosRegulares = problema.modulo.matriculas.map((m) => m.usuario)

  // Visitantes RECEBIDOS neste problema/tipoEncontro
  const situacoesRecebidas = await prisma.situacaoExcepcional.findMany({
    where:   { problemaDestinoId: problemaId, tipoEncontro: tipoEncontro as any },
    include: { aluno: { select: { id: true, nome: true } } },
  })
  const alunosVisitantes = situacoesRecebidas.map((s) => s.aluno)

  // ─── ALUNO ────────────────────────────────────────────────────────────────
  if (session.user?.papel === 'ALUNO') {

    // ── CAMINHO A: aluno chegou direto ao problema DESTINO ──────────────────
    // (dashboard gerou link com o problemaId do destino, e.g. externo=1)
    // Basta verificar se o userId está na lista de visitantes recebidos aqui
    const seComoDestinatario = situacoesRecebidas.find((s) => s.alunoId === userId)

    if (seComoDestinatario) {
      // problemaId JÁ é o destino → problemaEfetivoId = problemaId (sem redirecionamento)
      const todos = [...alunosRegulares, ...alunosVisitantes]
      const grupoCompleto = todos.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

      return NextResponse.json({
        grupo:             grupoCompleto,
        estaVisitando:     true,
        estaMatriculado:   false,
        problemaEfetivoId: problemaId,          // já é o destino correto
        moduloDestino: {
          id:      moduloId,
          nome:    problema.modulo.nome,
          tutoria: problema.modulo.tutoria,
        },
      })
    }

    // ── CAMINHO B: aluno chegou pelo problema de ORIGEM ─────────────────────
    // Busca SE onde o aluno originou DESTE módulo para algum destino
    const seVisitante = await prisma.situacaoExcepcional.findFirst({
      where: {
        alunoId:        userId,
        moduloOrigemId: moduloId,               // este módulo É o de origem
        tipoEncontro:   tipoEncontro as any,
      },
      include: {
        problemaDestino: {
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

    // Só aplica SE se o número do problema de origem coincide com o número
    // do problema destino — assim Abertura P1 não é confundida com Abertura P4
    if (seVisitante && seVisitante.problemaDestino.numero === problema.numero) {
      // Encontrou SE de origem → retorna grupo do módulo destino
      const grupoDestino = seVisitante.problemaDestino.modulo.matriculas.map((m) => m.usuario)

      const coVisitantes = await prisma.situacaoExcepcional.findMany({
        where: {
          problemaDestinoId: seVisitante.problemaDestinoId,
          tipoEncontro:      tipoEncontro as any,
          alunoId:           { not: userId },
        },
        include: { aluno: { select: { id: true, nome: true } } },
      })
      const alunosCoVisitantes = coVisitantes.map((v) => v.aluno)

      const todos = [
        ...grupoDestino,
        ...alunosCoVisitantes,
        { id: userId, nome: session.user?.nome ?? '' },
      ]
      const grupoCompleto = todos.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

      return NextResponse.json({
        grupo:             grupoCompleto,
        estaVisitando:     true,
        estaMatriculado:   false,
        problemaEfetivoId: seVisitante.problemaDestinoId,
        moduloDestino: {
          id:      seVisitante.problemaDestino.modulo.id,
          nome:    seVisitante.problemaDestino.modulo.nome,
          tutoria: seVisitante.problemaDestino.modulo.tutoria,
        },
      })
    }

    // ── Regular: verifica pertencimento ────────────────────────────────────
    const pertence = alunosRegulares.some((a) => a.id === userId)
    if (!pertence)
      return NextResponse.json({ error: 'Você não pertence a este grupo' }, { status: 403 })

    // Grupo = regulares + visitantes recebidos (sem duplicatas)
    const todos = [...alunosRegulares, ...alunosVisitantes]
    const grupoCompleto = todos.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

    return NextResponse.json({
      grupo:             grupoCompleto,
      estaVisitando:     false,
      estaMatriculado:   true,
      problemaEfetivoId: problemaId,
      visitantes:        alunosVisitantes,
      modulo: {
        id:      moduloId,
        nome:    problema.modulo.nome,
        tutoria: problema.modulo.tutoria,
      },
    })
  }

  // ─── TUTOR ────────────────────────────────────────────────────────────────
  if (session.user?.papel === 'TUTOR') {
    const eTitular = problema.modulo.tutorId === userId
    if (!eTitular) {
      const permissao = await prisma.coTutorPermissao.findFirst({
        where: {
          tutorId:      userId,
          moduloId,
          problemaId,
          tipoEncontro: tipoEncontro as any,
        },
      })
      if (!permissao)
        return NextResponse.json({ error: 'Sem permissão para este encontro' }, { status: 403 })
    }

    const todos = [...alunosRegulares, ...alunosVisitantes]
    const grupoCompleto = todos.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

    const visitantesIds = new Set(alunosVisitantes.map((v) => v.id))

    return NextResponse.json({
      grupo:      grupoCompleto.map((a) => ({ ...a, visitante: visitantesIds.has(a.id) })),
      visitantes: alunosVisitantes,
      modulo: {
        id:      moduloId,
        nome:    problema.modulo.nome,
        tutoria: problema.modulo.tutoria,
      },
    })
  }

  return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
}
