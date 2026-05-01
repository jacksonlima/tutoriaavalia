/**
 * TutoriaAvalia v2 — API: Co-tutores (v2)
 * Autor: Jackson Lima — CESUPA
 *
 * Permissões granulares: cada registro = (módulo, tutor, problema, tipoEncontro)
 * Co-tutor só acessa exatamente o que o titular selecionou.
 *
 * GET    /api/co-tutores?moduloId=X
 * POST   /api/co-tutores  { moduloId, tutorId, permissoes: [{problemaId, tipoEncontro}] }
 * DELETE /api/co-tutores  { moduloId, tutorId }
 */
import { auth }         from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const moduloId = new URL(req.url).searchParams.get('moduloId')
  if (!moduloId)
    return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  const permissoes = await prisma.coTutorPermissao.findMany({
    where:   { moduloId },
    include: {
      tutor:    { select: { id: true, nome: true, email: true } },
      problema: { select: { id: true, numero: true, nome: true } },
    },
    orderBy: [{ tutorId: 'asc' }, { problema: { numero: 'asc' } }],
  })

  // Agrupa por tutor → lista de {problema, tipoEncontro}
  const porTutor = new Map<string, any>()
  for (const p of permissoes) {
    if (!porTutor.has(p.tutorId)) {
      porTutor.set(p.tutorId, {
        tutorId:    p.tutorId,
        tutor:      p.tutor,
        moduloId:   p.moduloId,
        permissoes: [],
      })
    }
    porTutor.get(p.tutorId).permissoes.push({
      problemaId:   p.problemaId,
      problema:     p.problema,
      tipoEncontro: p.tipoEncontro,
    })
  }

  return NextResponse.json(Array.from(porTutor.values()))
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Body: { moduloId, tutorId, permissoes: [{problemaId, tipoEncontro}] }
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { moduloId, tutorId, permissoes } = await req.json()

  if (!moduloId || !tutorId || !Array.isArray(permissoes) || permissoes.length === 0)
    return NextResponse.json(
      { error: 'moduloId, tutorId e permissoes (array) são obrigatórios' },
      { status: 400 },
    )

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  if (tutorId === session?.user?.id)
    return NextResponse.json(
      { error: 'O titular não pode ser co-tutor do próprio módulo' },
      { status: 400 },
    )

  const substituto = await prisma.usuario.findUnique({ where: { id: tutorId } })
  if (!substituto || substituto.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Usuário não encontrado ou não é tutor' }, { status: 404 })

  // Valida que cada permissão tem problemaId e tipoEncontro
  for (const p of permissoes) {
    if (!p.problemaId || !p.tipoEncontro) {
      return NextResponse.json(
        { error: 'Cada permissão precisa de problemaId e tipoEncontro' },
        { status: 400 },
      )
    }
  }

  // Remove permissões antigas e recria
  await prisma.coTutorPermissao.deleteMany({ where: { moduloId, tutorId } })

  await prisma.coTutorPermissao.createMany({
    data: permissoes.map((p: { problemaId: string; tipoEncontro: string }) => ({
      moduloId,
      tutorId,
      problemaId:   p.problemaId,
      tipoEncontro: p.tipoEncontro as any,
    })),
    skipDuplicates: true,
  })

  // Retorna lista atualizada agrupada
  const resultado = await prisma.coTutorPermissao.findMany({
    where:   { moduloId, tutorId },
    include: {
      tutor:    { select: { id: true, nome: true, email: true } },
      problema: { select: { id: true, numero: true, nome: true } },
    },
    orderBy: [{ problema: { numero: 'asc' } }],
  })

  const agrupado = {
    tutorId,
    tutor:      resultado[0]?.tutor,
    moduloId,
    permissoes: resultado.map(r => ({
      problemaId:   r.problemaId,
      problema:     r.problema,
      tipoEncontro: r.tipoEncontro,
    })),
  }

  return NextResponse.json({ ok: true, coTutor: agrupado })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { moduloId, tutorId } = await req.json()
  if (!moduloId || !tutorId)
    return NextResponse.json({ error: 'moduloId e tutorId são obrigatórios' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  await prisma.coTutorPermissao.deleteMany({ where: { moduloId, tutorId } })
  return NextResponse.json({ ok: true })
}
