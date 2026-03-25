import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// GET /api/co-tutores?moduloId=X
// Lista co-tutores com suas permissões
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const moduloId = new URL(req.url).searchParams.get('moduloId')
  if (!moduloId) return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session.user.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  const coTutores = await prisma.coTutor.findMany({
    where:   { moduloId },
    include: {
      tutor:      { select: { id: true, nome: true, email: true } },
      permissoes: { select: { id: true, problemaId: true, tipoEncontro: true } },
    },
    orderBy: { criadoEm: 'asc' },
  })

  return NextResponse.json(coTutores)
}

// ─────────────────────────────────────────────────────────────
// POST /api/co-tutores
// Cria co-tutor + permissões granulares
// Body: { moduloId, email, permissoes: [{problemaId, tipoEncontro}] }
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { moduloId, email, permissoes } = await req.json()
  if (!moduloId || !email)
    return NextResponse.json({ error: 'moduloId e email são obrigatórios' }, { status: 400 })

  if (!Array.isArray(permissoes) || permissoes.length === 0)
    return NextResponse.json({ error: 'Selecione pelo menos uma permissão.' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session.user.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  const substituto = await prisma.usuario.findUnique({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, nome: true, email: true, papel: true },
  })

  if (!substituto)
    return NextResponse.json(
      { error: 'Docente não encontrado. O substituto precisa ter feito login pelo menos uma vez.' },
      { status: 404 }
    )

  if (substituto.papel !== 'TUTOR')
    return NextResponse.json({ error: 'O usuário não é docente.' }, { status: 400 })

  if (substituto.id === session.user.id)
    return NextResponse.json({ error: 'Você já é o titular deste módulo.' }, { status: 400 })

  // Cria ou recupera o CoTutor
  const coTutor = await prisma.coTutor.upsert({
    where:  { moduloId_tutorId: { moduloId, tutorId: substituto.id } },
    update: {},
    create: { moduloId, tutorId: substituto.id },
  })

  // Substitui todas as permissões (delete + recreate)
  await prisma.coTutorPermissao.deleteMany({ where: { coTutorId: coTutor.id } })
  await prisma.coTutorPermissao.createMany({
    data: permissoes.map((p: { problemaId: string; tipoEncontro: string }) => ({
      coTutorId:    coTutor.id,
      problemaId:   p.problemaId,
      tipoEncontro: p.tipoEncontro as any,
    })),
    skipDuplicates: true,
  })

  const resultado = await prisma.coTutor.findUnique({
    where:   { id: coTutor.id },
    include: {
      tutor:      { select: { id: true, nome: true, email: true } },
      permissoes: { select: { id: true, problemaId: true, tipoEncontro: true } },
    },
  })

  return NextResponse.json(resultado)
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/co-tutores  — atualiza permissões de um co-tutor
// Body: { coTutorId, permissoes: [{problemaId, tipoEncontro}] }
// ─────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { coTutorId, permissoes } = await req.json()
  if (!coTutorId || !Array.isArray(permissoes))
    return NextResponse.json({ error: 'coTutorId e permissoes são obrigatórios' }, { status: 400 })

  const coTutor = await prisma.coTutor.findUnique({
    where:   { id: coTutorId },
    include: { modulo: true },
  })
  if (!coTutor || coTutor.modulo.tutorId !== session.user.id)
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.coTutorPermissao.deleteMany({ where: { coTutorId } })
  if (permissoes.length > 0) {
    await prisma.coTutorPermissao.createMany({
      data: permissoes.map((p: { problemaId: string; tipoEncontro: string }) => ({
        coTutorId,
        problemaId:   p.problemaId,
        tipoEncontro: p.tipoEncontro as any,
      })),
      skipDuplicates: true,
    })
  }

  return NextResponse.json({ ok: true })
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/co-tutores
// ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { moduloId, tutorId } = await req.json()
  if (!moduloId || !tutorId)
    return NextResponse.json({ error: 'moduloId e tutorId são obrigatórios' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session.user.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  // Cascade deletes permissoes automatically
  await prisma.coTutor.deleteMany({ where: { moduloId, tutorId } })
  return NextResponse.json({ ok: true })
}
