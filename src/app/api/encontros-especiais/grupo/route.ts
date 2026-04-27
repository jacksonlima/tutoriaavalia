import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/encontros-especiais/grupo?problemaId=X&tipoEncontro=Y
//
// Retorna os alunos do módulo ao qual o problema pertence.
// SituacaoExcepcional relaciona problemas entre si (não alunos a problemas),
// por isso a lógica de "visitantes" foi removida — o schema não suporta esse conceito.
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'ALUNO')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const url          = new URL(req.url)
  const problemaId   = url.searchParams.get('problemaId')
  const tipoEncontro = url.searchParams.get('tipoEncontro')

  if (!problemaId || !tipoEncontro)
    return NextResponse.json({ error: 'problemaId e tipoEncontro são obrigatórios' }, { status: 400 })

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

  const alunoId     = session?.user?.id
  const matriculados = problema.modulo.matriculas.map((m) => m.usuario)
  const pertenceAoGrupo = matriculados.some((a) => a.id === alunoId)

  if (!pertenceAoGrupo)
    return NextResponse.json({ error: 'Você não pertence a este grupo' }, { status: 403 })

  return NextResponse.json({
    grupo:          matriculados,
    estaVisitando:  false,
    estaMatriculado: true,
    modulo: {
      id:      problema.modulo.id,
      nome:    problema.modulo.nome,
      tutoria: problema.modulo.tutoria,
    },
  })
}