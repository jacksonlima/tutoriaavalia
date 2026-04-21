import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/usuarios/buscar?q=texto   — autocomplete alunos no formulário de módulo
// GET /api/usuarios/buscar?email=x   — busca docente exato para wizard de substituto
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const url = new URL(req.url)

  // ── Busca exata por email (wizard de substituto) ─────────────
  const emailExato = url.searchParams.get('email')
  if (emailExato) {
    const usuario = await prisma.usuario.findUnique({
      where:  { email: emailExato.toLowerCase().trim() },
      select: { id: true, nome: true, email: true, papel: true },
    })
    if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    return NextResponse.json(usuario)
  }

  // ── Autocomplete por texto (formulário de módulo) ─────────────
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json([])

  const usuarios = await prisma.usuario.findMany({
    where: {
      papel: 'ALUNO',
      OR: [
        { nome:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select:  { id: true, nome: true, email: true },
    orderBy: { nome: 'asc' },
    take: 8,
  })

  return NextResponse.json(usuarios)
}
