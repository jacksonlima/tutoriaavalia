/**
 * TutoriaAvalia v2 — GET /api/encontros-especiais/grupo?problemaId=X&tipoEncontro=Y
 *
 * Retorna o grupo efetivo para um encontro, incluindo alunos visitantes
 * realocados via Situação Excepcional.
 *
 * Para ALUNO:
 *   • Visitante (tem SE onde moduloOrigemId = módulo do problema, tipoEncontro igual):
 *     → retorna grupo do módulo DESTINO + co-visitantes
 *     → inclui `estaVisitando: true` e `problemaEfetivoId` (problema onde notas são salvas)
 *   • Regular: retorna alunos do próprio módulo + visitantes recebidos
 *
 * Para TUTOR:
 *   • Retorna alunos matriculados + visitantes recebidos (com flag `visitante: true`)
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
    // Verifica se este aluno É visitante: tem SE onde originou deste módulo neste tipo de encontro
    const seVisitante = await prisma.situacaoExcepcional.findFirst({
      where: {
        alunoId:        userId,
        moduloOrigemId: moduloId,
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

    if (seVisitante) {
      // É VISITANTE → retorna grupo do módulo destino + co-visitantes + si mesmo
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

      // Grupo completo sem duplicatas
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

    // É REGULAR → verifica pertencimento
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
        id:      problema.modulo.id,
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

    // Grupo = matriculados + visitantes recebidos (sem duplicatas)
    const todos = [...alunosRegulares, ...alunosVisitantes]
    const grupoCompleto = todos.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)

    // IDs dos visitantes para marcar visualmente no front
    const visitantesIds = new Set(alunosVisitantes.map((v) => v.id))

    return NextResponse.json({
      grupo:        grupoCompleto.map((a) => ({ ...a, visitante: visitantesIds.has(a.id) })),
      visitantes:   alunosVisitantes,
      modulo: {
        id:      problema.modulo.id,
        nome:    problema.modulo.nome,
        tutoria: problema.modulo.tutoria,
      },
    })
  }

  return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
}
