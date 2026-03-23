import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/usuarios/buscar?q=texto
// Busca usuários pelo nome ou email (para autocomplete no formulário de módulo)
// Acessível apenas para tutores
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()

  // Mínimo de 2 caracteres para iniciar a busca
  if (q.length < 2) {
    return NextResponse.json([])
  }

  const usuarios = await prisma.usuario.findMany({
    where: {
      papel: 'ALUNO',
      OR: [
        { nome:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id:    true,
      nome:  true,
      email: true,
    },
    orderBy: { nome: 'asc' },
    take: 8, // máximo de 8 sugestões
  })

  return NextResponse.json(usuarios)
}
