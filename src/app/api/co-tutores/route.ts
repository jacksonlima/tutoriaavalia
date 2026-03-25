import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/co-tutores?moduloId=X — lista co-tutores do módulo
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const moduloId = new URL(req.url).searchParams.get('moduloId')
  if (!moduloId) return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  // Só o titular pode ver/gerenciar co-tutores
  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session.user.id) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  const coTutores = await prisma.coTutor.findMany({
    where:   { moduloId },
    include: { tutor: { select: { id: true, nome: true, email: true } } },
    orderBy: { criadoEm: 'asc' },
  })

  return NextResponse.json(coTutores)
}

// POST /api/co-tutores — adiciona co-tutor
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { moduloId, email } = await req.json()
  if (!moduloId || !email) {
    return NextResponse.json({ error: 'moduloId e email são obrigatórios' }, { status: 400 })
  }

  // Verifica que o módulo pertence ao professor logado
  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session.user.id) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  // Busca o substituto pelo email
  const substituto = await prisma.usuario.findUnique({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, nome: true, email: true, papel: true },
  })

  if (!substituto) {
    return NextResponse.json(
      { error: 'Docente não encontrado. O substituto precisa ter feito login pelo menos uma vez.' },
      { status: 404 }
    )
  }

  if (substituto.papel !== 'TUTOR') {
    return NextResponse.json(
      { error: 'O usuário não é um docente (papel TUTOR).' },
      { status: 400 }
    )
  }

  if (substituto.id === session.user.id) {
    return NextResponse.json(
      { error: 'Você já é o titular deste módulo.' },
      { status: 400 }
    )
  }

  // Cria o co-tutor (upsert para evitar duplicata)
  const coTutor = await prisma.coTutor.upsert({
    where:  { moduloId_tutorId: { moduloId, tutorId: substituto.id } },
    update: {},
    create: { moduloId, tutorId: substituto.id },
    include: { tutor: { select: { id: true, nome: true, email: true } } },
  })

  return NextResponse.json(coTutor)
}

// DELETE /api/co-tutores — remove co-tutor
export async function DELETE(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { moduloId, tutorId } = await req.json()
  if (!moduloId || !tutorId) {
    return NextResponse.json({ error: 'moduloId e tutorId são obrigatórios' }, { status: 400 })
  }

  // Verifica que o módulo pertence ao professor logado
  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session.user.id) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  await prisma.coTutor.deleteMany({ where: { moduloId, tutorId } })
  return NextResponse.json({ ok: true })
}
