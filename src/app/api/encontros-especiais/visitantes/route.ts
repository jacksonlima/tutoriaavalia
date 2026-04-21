import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/encontros-especiais/visitantes?problemaId=X&tipoEncontro=Y
// Retorna alunos visitantes de outros módulos para este problema/encontro.
// Usado pelo professor anfitrião (Prof B) para ver quem avaliar.
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const url            = new URL(req.url)
  const problemaId     = url.searchParams.get('problemaId')
  const tipoEncontro   = url.searchParams.get('tipoEncontro')

  if (!problemaId || !tipoEncontro)
    return NextResponse.json({ error: 'problemaId e tipoEncontro obrigatórios' }, { status: 400 })

  // Verifica que o problema pertence a um módulo deste professor
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: true },
  })
  if (!problema || problema.modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })

  const encontros = await prisma.situacaoExcepcional.findMany({
    where: { problemaDestinoId: problemaId, tipoEncontro: tipoEncontro as any },
    include: {
      aluno: { select: { id: true, nome: true, email: true } },
      moduloOrigem: { select: { nome: true, tutoria: true, turma: true } },
    },
  })

  // Retorna alunos visitantes com info do módulo de origem
  return NextResponse.json(
    encontros.map((e) => ({
      ...e.aluno,
      visitante:    true,
      moduloOrigem: e.moduloOrigem,
    }))
  )
}
