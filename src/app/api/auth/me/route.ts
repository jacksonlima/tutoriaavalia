import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      avatarUrl: true,
    },
  })

  if (!usuario) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  return NextResponse.json(usuario)
}
