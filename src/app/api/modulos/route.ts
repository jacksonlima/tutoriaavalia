import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { criarModuloSchema } from '@/lib/validations'
import { Papel } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/modulos
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (session.user.papel === 'TUTOR') {
    const modulos = await prisma.modulo.findMany({
      where: { tutorId: session.user.id, arquivado: false },
      include: {
        problemas: { orderBy: { numero: 'asc' } },
        matriculas: {
          include: { usuario: { select: { id: true, nome: true, email: true } } },
          orderBy: { numeraNaTurma: 'asc' },
        },
        _count: { select: { matriculas: true } },
      },
      orderBy: { criadoEm: 'desc' },
    })
    return NextResponse.json(modulos)
  }

  // Aluno: módulos em que está matriculado
  const matriculas = await prisma.matricula.findMany({
    where: { usuarioId: session.user.id },
    include: {
      modulo: {
        include: {
          problemas: { orderBy: { numero: 'asc' } },
          tutor:     { select: { nome: true } },
          matriculas: {
            include: { usuario: { select: { id: true, nome: true } } },
            orderBy: { numeraNaTurma: 'asc' },
          },
        },
      },
    },
  })
  return NextResponse.json(matriculas.map((m) => m.modulo))
}

// POST /api/modulos
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  if (Array.isArray(body.nomesProblemas)) {
    body.nomesProblemas = body.nomesProblemas.map((n: string) => n?.trim() ?? '')
  }

  const result = criarModuloSchema.safeParse(body)
  if (!result.success) {
    const erros    = result.error.flatten()
    const mensagem =
      erros.fieldErrors.emailsAlunos?.[0]          ??
      erros.fieldErrors.nome?.[0]                  ??
      erros.fieldErrors.tutoria?.[0]               ??
      erros.fieldErrors.turma?.[0]                 ??
      erros.fieldErrors.quantidadeProblemas?.[0]   ??
      'Preencha todos os campos obrigatórios'
    return NextResponse.json({ error: mensagem, detalhes: erros }, { status: 400 })
  }

  const {
    nome, ano, tutoria, turma,
    emailsAlunos, nomesProblemas,
    quantidadeProblemas,
    temSaltoTriplo, problemasSaltoTriplo,
  } = result.data

  // Garante que todos os alunos existam no banco
  const alunos = await Promise.all(
    emailsAlunos.map((email) =>
      prisma.usuario.upsert({
        where:  { email },
        update: {},
        create: { email, nome: email.split('@')[0], papel: Papel.ALUNO },
      })
    )
  )

  // Conjunto de números de problema com salto triplo
  const saltoSet = new Set(problemasSaltoTriplo ?? [])

  const modulo = await prisma.$transaction(async (tx) => {
    const novoModulo = await tx.modulo.create({
      data: { nome, ano, tutoria, turma, tutorId: session.user.id },
    })

    // Cria os problemas conforme quantidade informada
    for (let i = 0; i < quantidadeProblemas; i++) {
      const numProb      = i + 1
      const comSalto     = temSaltoTriplo && saltoSet.has(numProb)
      const nomeProb     = nomesProblemas?.[i]?.trim() || `Problema ${String(numProb).padStart(2, '0')}`

      await tx.problema.create({
        data: {
          moduloId:       novoModulo.id,
          numero:         numProb,
          nome:           nomeProb,
          temSaltoTriplo: comSalto,
          // Todos os encontros iniciam desativados — professor ativa um a um
          aberturaAtiva:   false,
          fechamentoAtivo: false,
          fechamentoAAtivo: false,
          fechamentoBAtivo: false,
        },
      })
    }

    // Matrículas
    for (let i = 0; i < alunos.length; i++) {
      await tx.matricula.create({
        data: {
          moduloId:     novoModulo.id,
          usuarioId:    alunos[i].id,
          numeraNaTurma: i + 1,
        },
      })
    }

    return novoModulo
  })

  return NextResponse.json(modulo, { status: 201 })
}
