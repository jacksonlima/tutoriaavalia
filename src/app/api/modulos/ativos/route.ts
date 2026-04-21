import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/modulos/ativos
// Retorna todos os módulos ativos (de qualquer professor) com seus problemas.
// Usado pelo professor A para selecionar o destino dos alunos.
export async function GET() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const modulos = await prisma.modulo.findMany({
    where: { ativo: true, arquivado: false },
    include: {
      tutor:    { select: { nome: true } },
      problemas: { orderBy: { numero: 'asc' } },
    },
    orderBy: [{ ano: 'desc' }, { nome: 'asc' }],
  })

  return NextResponse.json(modulos)
}
