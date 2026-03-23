import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const modulos = await prisma.modulo.findMany({
    where:   { tutorId: session.user.id, arquivado: true },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, nome: true } } },
        orderBy: { numeraNaTurma: 'asc' },
      },
      _count: { select: { matriculas: true } },
    },
    orderBy: { atualizadoEm: 'desc' },
  })

  return NextResponse.json(modulos)
}
