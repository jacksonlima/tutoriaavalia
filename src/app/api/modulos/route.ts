/**
 * Notas da Tutoria v2 — API: Módulos
 * Autor: Jackson Lima — CESUPA
 *
 * GET /api/modulos
 *
 * TUTOR: retorna seus módulos completos (titular + co-tutor)
 * ALUNO: retorna módulos em que está matriculado
 *
 * FIND-NEW-01 (segurança): campos sensíveis removidos para ALUNO
 * FIX VISIBILIDADE: retorna TODOS os problemas (ativos e inativos)
 * para que o módulo apareça no dashboard mesmo sem encontros ativos.
 * O frontend decide o que mostrar — apenas esconde botão "Avaliar"
 * quando o encontro não está ativo.
 */
import { auth }              from '@/lib/auth'
import { criarModuloSchema } from '@/lib/validations'
import { Papel }             from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // ── TUTOR ─────────────────────────────────────────────────────────────────
  if (session?.user?.papel === 'TUTOR') {
    const userId = session?.user?.id!

    const coTutorPerms = await prisma.coTutorPermissao.findMany({
      where:  { tutorId: userId },
      select: { moduloId: true, problemaId: true, tipoEncontro: true },
    })

    const coTutorModuloIds = [...new Set(coTutorPerms.map((p: any) => p.moduloId))]

    const permMap = new Map<string, Set<string>>()
    for (const p of coTutorPerms) {
      if (!permMap.has(p.moduloId)) permMap.set(p.moduloId, new Set())
      permMap.get(p.moduloId)!.add(`${p.problemaId}|${p.tipoEncontro}`)
    }

    const modulos = await prisma.modulo.findMany({
      where: {
        arquivado: false,
        OR: [
          { tutorId: userId },
          { id: { in: coTutorModuloIds } },
        ],
      },
      include: {
        tutor:      { select: { nome: true } },
        problemas:  { orderBy: { numero: 'asc' } },
        matriculas: {
          include: { usuario: { select: { id: true, nome: true, email: true } } },
          orderBy: { numeraNaTurma: 'asc' },
        },
        _count: { select: { matriculas: true } },
      },
      orderBy: { criadoEm: 'desc' },
    })

    const modulosComPerms = modulos.map((m: any) => {
      const eTitular = m.tutorId === userId
      if (eTitular) return { ...m, eTitular: true, permissoesCoTutor: null }

      const permsDoModulo = permMap.get(m.id) ?? new Set()
      const problemasPermitidosIds = new Set(
        [...permsDoModulo].map(k => k.split('|')[0])
      )

      const problemasFiltrados = m.problemas
        .filter((p: any) => problemasPermitidosIds.has(p.id))
        .map((p: any) => ({
          ...p,
          _permissoesCoTutor: {
            abertura:    permsDoModulo.has(`${p.id}|ABERTURA`),
            fechamento:  permsDoModulo.has(`${p.id}|FECHAMENTO`),
            fechamentoA: permsDoModulo.has(`${p.id}|FECHAMENTO_A`),
            fechamentoB: permsDoModulo.has(`${p.id}|FECHAMENTO_B`),
          },
        }))

      return {
        ...m,
        eTitular: false,
        problemas: problemasFiltrados,
        permissoesCoTutor: [...permsDoModulo],
      }
    })

    return NextResponse.json(modulosComPerms)
  }

  // ── ALUNO ─────────────────────────────────────────────────────────────────
  // FIND-NEW-01: campos sensíveis removidos (tutorId interno, IDs de matrícula)
  // FIX VISIBILIDADE: retorna TODOS os problemas (ativos e inativos)
  // O módulo deve ser visível mesmo quando não há encontros ativos.
  // O dashboard controla o que exibir com base nos flags de ativo.
  const matriculas = await prisma.matricula.findMany({
    where: {
      usuarioId: session?.user?.id,
      modulo:    { arquivado: false },
    },
    include: {
      modulo: {
        include: {
          tutor:      { select: { nome: true } },
          problemas:  { orderBy: { numero: 'asc' } },
          matriculas: {
            include: { usuario: { select: { id: true, nome: true } } },
            orderBy: { numeraNaTurma: 'asc' },
          },
        },
      },
    },
  })

  const modulosFiltrados = matriculas.map((mat: any) => {
    const m = mat.modulo

    // Retorna TODOS os problemas com seus status de ativo
    // O dashboard decide o que mostrar (botão "Avaliar" apenas quando ativo)
    // Campos retornados: só o necessário para o frontend — sem dados futuros sensíveis
    const problemas = m.problemas.map((p: any) => ({
      id:               p.id,
      numero:           p.numero,
      nome:             p.nome,
      temSaltoTriplo:   p.temSaltoTriplo,
      // Flags de ativo — necessários para o dashboard mostrar/ocultar botões
      aberturaAtiva:    p.aberturaAtiva,
      fechamentoAtivo:  p.fechamentoAtivo,
      fechamentoAAtivo: p.fechamentoAAtivo,
      fechamentoBAtivo: p.fechamentoBAtivo,
    }))

    // Colegas: apenas id e nome (sem IDs de matrícula)
    const colegas = m.matriculas.map((mc: any) => ({
      id:   mc.usuario.id,
      nome: mc.usuario.nome,
    }))

    return {
      id:      m.id,
      nome:    m.nome,
      ano:     m.ano,
      tutoria: m.tutoria,
      turma:   m.turma,
      tutor:   { nome: m.tutor.nome },
      // Todos os problemas — módulo aparece mesmo sem encontros ativos
      problemas,
      matriculas: colegas.map((c: any) => ({ usuario: c })),
    }
  })

  return NextResponse.json(modulosFiltrados)
}

export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body   = await req.json()
  const result = criarModuloSchema.safeParse(body)
  if (!result.success)
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { nome, ano, tutoria, turma, semestre, alunos } = result.data

  const erros: string[] = []
  const matriculas: { email: string; nome: string }[] = []

  for (const email of (alunos ?? [])) {
    const emailLower = email.toLowerCase().trim()
    const usuario = await prisma.usuario.findUnique({ where: { email: emailLower } })
    if (!usuario) { erros.push(`Aluno não encontrado: ${email}`); continue }
    if (usuario.papel !== 'ALUNO') { erros.push(`${email} não é um aluno`); continue }
    matriculas.push({ email: emailLower, nome: usuario.nome })
  }

  if (erros.length > 0)
    return NextResponse.json({ error: erros.join('; ') }, { status: 400 })

  const modulo = await prisma.$transaction(async (tx: any) => {
    const novoModulo = await tx.modulo.create({
      data: {
        nome, ano, tutoria, turma,
        semestre: semestre ?? '01º Semestre',
        tutorId: session?.user?.id!,
      },
    })

    for (let i = 0; i < matriculas.length; i++) {
      const usuario = await tx.usuario.findUnique({
        where: { email: matriculas[i].email },
      })
      if (usuario) {
        await tx.matricula.create({
          data: { moduloId: novoModulo.id, usuarioId: usuario.id, numeraNaTurma: i + 1 },
        })
      }
    }

    return tx.modulo.findUnique({
      where: { id: novoModulo.id },
      include: {
        problemas:  { orderBy: { numero: 'asc' } },
        matriculas: { include: { usuario: { select: { id: true, nome: true, email: true } } } },
      },
    })
  })

  return NextResponse.json(modulo, { status: 201 })
}
