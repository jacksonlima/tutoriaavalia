import { auth } from '@/lib/auth'
import { Papel } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

// Verifica se userId é titular ou co-tutor do módulo
async function isTitularOuCoTutor(prisma: any, moduloId: string, userId: string): Promise<boolean> {
  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    include: { coTutores: { where: { tutorId: userId } } },
  })
  if (!modulo) return false
  if (modulo.tutorId === userId) return true
  return modulo.coTutores.length > 0
}


export const dynamic = 'force-dynamic'

// PATCH /api/modulos/[id]  — arquivar ou excluir módulo
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id: moduloId } = await params
  const { acao }         = await req.json() as { acao: 'arquivar' | 'excluir' }

  // Confirma que o módulo pertence a este tutor
  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  if (acao === 'arquivar') {
    // Apenas marca como arquivado — todos os dados são preservados
    await prisma.modulo.update({
      where: { id: moduloId },
      data:  { arquivado: true, ativo: false },
    })
    return NextResponse.json({ sucesso: true, acao: 'arquivado' })
  }

  if (acao === 'excluir') {
    // ── REGRA DE INTEGRIDADE ──────────────────────────────────────────
    // Módulos com avaliações lançadas (tutor ou aluno) NÃO podem ser
    // excluídos — apenas arquivados. Protege registros acadêmicos.
    const problemas = await prisma.problema.findMany({
      where:  { moduloId },
      select: { id: true },
    })
    const problemasIds = problemas.map((p) => p.id)

    const [temAvTutor, temAvAluno] = await Promise.all([
      prisma.avaliacaoTutor.count({ where: { problemaId: { in: problemasIds } } }),
      prisma.avaliacaoAluno.count({ where: { problemaId: { in: problemasIds } } }),
    ])

    if (temAvTutor > 0 || temAvAluno > 0) {
      return NextResponse.json(
        {
          error: 'Módulo possui avaliações lançadas e não pode ser excluído. Arquive-o para preservar os dados acadêmicos.',
          temAvaliacoes: true,
          totais: { tutor: temAvTutor, aluno: temAvAluno },
        },
        { status: 409 }, // 409 Conflict — estado do recurso impede a operação
      )
    }

    // Sem avaliações: exclusão em cascata é permitida
    await prisma.$transaction(async (tx) => {
      await tx.submissao.deleteMany({      where: { problemaId: { in: problemasIds } } })
      await tx.problema.deleteMany({       where: { moduloId } })
      await tx.matricula.deleteMany({      where: { moduloId } })
      await tx.modulo.delete({             where: { id: moduloId } })
    })
    return NextResponse.json({ sucesso: true, acao: 'excluido' })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}

// GET /api/modulos/[id] — retorna módulo arquivado específico
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id: moduloId } = await params

  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, nome: true, email: true } } },
        orderBy: { numeraNaTurma: 'asc' },
      },
      _count: { select: { matriculas: true } },
    },
  })

  // GET: titular ou co-tutor podem ver o módulo
  if (!modulo) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }
  const podeVer = await isTitularOuCoTutor(prisma, moduloId, session?.user?.id)
  if (!podeVer) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  // Conta avaliações para o frontend saber se pode exibir o botão "Excluir"
  const problemasIds = modulo.problemas.map((p) => p.id)
  const [totalAvTutor, totalAvAluno] = await Promise.all([
    prisma.avaliacaoTutor.count({ where: { problemaId: { in: problemasIds } } }),
    prisma.avaliacaoAluno.count({ where: { problemaId: { in: problemasIds } } }),
  ])

  return NextResponse.json({
    ...modulo,
    temAvaliacoes: totalAvTutor > 0 || totalAvAluno > 0,
  })
}

// PUT /api/modulos/[id] — editar informações do módulo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id: moduloId } = await params

  // Confirma que o módulo pertence a este tutor
  const modulo = await prisma.modulo.findUnique({
    where:   { id: moduloId },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, email: true } } },
        orderBy: { numeraNaTurma: 'asc' },
      },
    },
  })
  if (!modulo || modulo.tutorId !== session?.user?.id) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  const body = await req.json()

  // Validação básica inline (sem importar o schema para evitar conflito de imports)
  const { nome, ano, tutoria, turma, emailsAlunos, nomesProblemas } = body

  if (!nome || nome.length < 3) {
    return NextResponse.json({ error: 'Nome do módulo muito curto' }, { status: 400 })
  }
  if (!emailsAlunos || emailsAlunos.length === 0) {
    return NextResponse.json({ error: 'Adicione pelo menos 1 aluno' }, { status: 400 })
  }
  if (emailsAlunos.length > 11) {
    return NextResponse.json({ error: 'Máximo de 11 alunos' }, { status: 400 })
  }

  // Garante que todos os alunos existam no banco (cria se não existir)
  const alunosNovos = await Promise.all(
    (emailsAlunos as string[]).map((email: string) =>
      prisma.usuario.upsert({
        where:  { email },
        update: {},
        create: { email, nome: email.split('@')[0], papel: Papel.ALUNO },
      })
    )
  )

  await prisma.$transaction(async (tx) => {
    // 1. Atualiza dados básicos do módulo
    await tx.modulo.update({
      where: { id: moduloId },
      data:  { nome, ano: Number(ano), tutoria, turma },
    })

    // 2. Atualiza nomes dos problemas
    if (Array.isArray(nomesProblemas)) {
      for (let i = 0; i < modulo.problemas.length; i++) {
        const prob = modulo.problemas[i]
        const novoNome = (nomesProblemas[i] ?? '').trim()
        if (novoNome || prob.nome !== novoNome) {
          await tx.problema.update({
            where: { id: prob.id },
            data:  { nome: novoNome || `Problema ${String(prob.numero).padStart(2, '0')}` },
          })
        }
      }
    }

    // 3. Reconciliar lista de alunos
    const emailsAtuais   = modulo.matriculas.map((m) => m.usuario.email)
    const emailsDesejados = (emailsAlunos as string[]).map((e: string) => e.toLowerCase().trim())

    // Alunos a remover (estavam mas não estão mais na lista)
    const emailsRemover = emailsAtuais.filter((e) => !emailsDesejados.includes(e))
    for (const email of emailsRemover) {
      const usuario = modulo.matriculas.find((m) => m.usuario.email === email)?.usuario
      if (usuario) {
        await tx.matricula.deleteMany({
          where: { moduloId, usuarioId: usuario.id },
        })
      }
    }

    // Alunos a adicionar (estão na lista mas não tinham matrícula)
    const emailsExistentes = emailsAtuais.filter((e) => emailsDesejados.includes(e))
    let proximoNumero = modulo.matriculas.length + 1

    for (let i = 0; i < alunosNovos.length; i++) {
      const aluno  = alunosNovos[i]
      const jaExiste = emailsExistentes.includes(aluno.email)
      if (!jaExiste) {
        await tx.matricula.create({
          data: {
            moduloId,
            usuarioId:    aluno.id,
            numeraNaTurma: proximoNumero++,
          },
        })
      }
    }

    // 4. Reordena numeraNaTurma conforme nova ordem da lista
    for (let i = 0; i < alunosNovos.length; i++) {
      const aluno = alunosNovos[i]
      await tx.matricula.updateMany({
        where: { moduloId, usuarioId: aluno.id },
        data:  { numeraNaTurma: i + 1 },
      })
    }
  })

  return NextResponse.json({ sucesso: true })
}
