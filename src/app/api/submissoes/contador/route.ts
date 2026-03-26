/**
 * TutoriaAvalia v2 — Sistema de Avaliação Formativa para ABP
 * Autor: Jackson Lima — CESUPA
 *
 * GET /api/submissoes/contador?moduloId=X
 * Retorna o progresso de submissões por problema/tipo para o módulo informado.
 *
 * Resposta: Array de {
 *   problemaId, tipoEncontro, ativo,
 *   enviadas: number,   ← alunos que já submeteram
 *   total: number,      ← total de alunos esperados (matriculados - saídas + visitantes)
 * }
 *
 * Cálculo do "total":
 *   - Começa com os alunos MATRICULADOS no módulo
 *   - Subtrai alunos DELEGADOS PARA FORA via EncontroEspecial (por problema+tipo)
 *   - Soma VISITANTES recebidos via EncontroEspecial (por problema+tipo)
 */

import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const moduloId = searchParams.get('moduloId')
  if (!moduloId) {
    return NextResponse.json({ error: 'moduloId é obrigatório' }, { status: 400 })
  }

  // Verifica que o tutor tem acesso ao módulo (titular ou co-tutor)
  const [modulo, coTutor] = await Promise.all([
    prisma.modulo.findFirst({
      where:   { id: moduloId, tutorId: session.user.id },
      select:  { id: true },
    }),
    prisma.coTutor.findFirst({
      where:  { moduloId, tutorId: session.user.id },
      select: { id: true },
    }),
  ])

  if (!modulo && !coTutor) {
    return NextResponse.json({ error: 'Acesso negado a este módulo' }, { status: 403 })
  }

  // Busca problemas do módulo com seus encontros ativos
  const problemas = await prisma.problema.findMany({
    where:  { moduloId },
    select: {
      id:              true,
      numero:          true,
      aberturaAtiva:   true,
      fechamentoAtivo: true,
      temSaltoTriplo:  true,
      fechamentoAAtivo: true,
      fechamentoBAtivo: true,
    },
    orderBy: { numero: 'asc' },
  })

  // Total de matriculados no módulo
  const totalMatriculados = await prisma.matricula.count({ where: { moduloId } })

  // IDs dos alunos matriculados
  const matriculas = await prisma.matricula.findMany({
    where:  { moduloId },
    select: { usuarioId: true },
  })
  const alunosMatriculadosIds = matriculas.map((m: any) => m.usuarioId)

  const resultado = []

  // Tipos de encontro a verificar por problema
  const tiposPorProblema = (prob: any) => {
    const tipos: { tipo: string; ativo: boolean }[] = [
      { tipo: 'ABERTURA',     ativo: prob.aberturaAtiva   },
      { tipo: 'FECHAMENTO',   ativo: prob.fechamentoAtivo },
    ]
    if (prob.temSaltoTriplo) {
      tipos.push(
        { tipo: 'FECHAMENTO_A', ativo: prob.fechamentoAAtivo },
        { tipo: 'FECHAMENTO_B', ativo: prob.fechamentoBAtivo },
      )
    }
    return tipos
  }

  for (const prob of problemas) {
    for (const { tipo, ativo } of tiposPorProblema(prob)) {
      // Alunos delegados PARA FORA (saíram do grupo para este tipo+prob)
      const delegadosParaFora = await prisma.encontroEspecial.count({
        where: {
          moduloOrigemId: moduloId,
          tipoEncontro:   tipo,
          // O aluno está matriculado neste módulo e foi delegado a outro problema deste tipo
          aluno: { matriculas: { some: { moduloId } } },
        },
      })

      // Visitantes recebidos neste problema+tipo (vieram de outros módulos)
      const visitantesRecebidos = await prisma.encontroEspecial.count({
        where: { problemaDestinoId: prob.id, tipoEncontro: tipo },
      })

      const total   = totalMatriculados - delegadosParaFora + visitantesRecebidos
      const enviadas = await prisma.submissao.count({
        where: { problemaId: prob.id, tipoEncontro: tipo },
      })

      resultado.push({
        problemaId:    prob.id,
        problemaNumero: prob.numero,
        tipoEncontro:  tipo,
        ativo,
        enviadas,
        total: Math.max(total, 0),
      })
    }
  }

  return NextResponse.json(resultado)
}
