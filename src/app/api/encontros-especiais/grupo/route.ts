import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/encontros-especiais/grupo?problemaId=X&tipoEncontro=Y
//
// Retorna o grupo completo de alunos que participam de um encontro,
// incluindo tanto os alunos matriculados no módulo QUANTO os visitantes
// (alunos de outros módulos redistribuídos via EncontroEspecial).
//
// Usado pela página do aluno para montar a lista de avaliação quando
// o aluno é visitante ou quando um aluno regular precisa ver os visitantes.
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'ALUNO')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const url          = new URL(req.url)
  const problemaId   = url.searchParams.get('problemaId')
  const tipoEncontro = url.searchParams.get('tipoEncontro')

  if (!problemaId || !tipoEncontro)
    return NextResponse.json({ error: 'problemaId e tipoEncontro são obrigatórios' }, { status: 400 })

  // Busca o problema e o módulo que o contém
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

  // Verifica se o aluno tem acesso: matriculado no módulo OU visitante via EncontroEspecial
  const alunoId       = session.user.id
  const matriculados  = problema.modulo.matriculas.map((m) => m.usuario)
  const estaMatriculado = matriculados.some((a) => a.id === alunoId)

  // Busca visitantes (alunos de outros módulos alocados para este problema+tipo)
  const visitantes = await prisma.encontroEspecial.findMany({
    where:   { problemaDestinoId: problemaId, tipoEncontro: tipoEncontro as any },
    include: { aluno: { select: { id: true, nome: true } } },
  })

  const estaVisitando = visitantes.some((v) => v.alunoId === alunoId)

  // Só retorna se o aluno pertence a este grupo
  if (!estaMatriculado && !estaVisitando)
    return NextResponse.json({ error: 'Você não pertence a este grupo' }, { status: 403 })

  // Combina: alunos regulares + visitantes (sem duplicatas)
  const alunosRegulares = matriculados
  const alunosVisitantes = visitantes
    .map((v) => ({ ...v.aluno, visitante: true }))
    .filter((v) => !alunosRegulares.some((r) => r.id === v.id))

  const grupo = [
    ...alunosRegulares,
    ...alunosVisitantes,
  ]

  return NextResponse.json({
    grupo,
    estaVisitando,
    estaMatriculado,
    modulo: {
      id:      problema.modulo.id,
      nome:    problema.modulo.nome,
      tutoria: problema.modulo.tutoria,
    },
  })
}
