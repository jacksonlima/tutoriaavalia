/**
 * TutoriaAvalia v2 — API: Co-tutores
 * Autor: Jackson Lima — CESUPA
 *
 * Reescrito para usar o model CoTutorPermissao (único model no schema atual).
 * Cada registro representa: tutor X tem acesso ao módulo Y (e opcionalmente ao problema Z).
 *
 * GET  /api/co-tutores?moduloId=X → lista co-tutores do módulo
 * POST /api/co-tutores            → adiciona co-tutor com lista de problemas
 * DELETE /api/co-tutores          → remove co-tutor do módulo
 */
import { auth }         from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const moduloId = new URL(req.url).searchParams.get('moduloId')
  if (!moduloId) return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  // Busca todos os co-tutores do módulo agrupados por tutor
  const permissoes = await prisma.coTutorPermissao.findMany({
    where:   { moduloId },
    include: {
      tutor:    { select: { id: true, nome: true, email: true } },
      problema: { select: { id: true, numero: true, nome: true } },
    },
    orderBy: { criadoEm: 'asc' },
  })

  // Agrupa por tutor para facilitar o frontend
  const porTutor = new Map<string, any>()
  for (const p of permissoes) {
    if (!porTutor.has(p.tutorId)) {
      porTutor.set(p.tutorId, {
        tutorId:    p.tutorId,
        tutor:      p.tutor,
        moduloId:   p.moduloId,
        problemas:  [],
      })
    }
    if (p.problema) {
      porTutor.get(p.tutorId).problemas.push(p.problema)
    }
  }

  return NextResponse.json(Array.from(porTutor.values()))
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Body: { moduloId, tutorId, problemasIds?: string[] }
// Se problemasIds vazio/omitido → acesso geral ao módulo (problemaId = null)
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { moduloId, tutorId, problemasIds } = await req.json()
  if (!moduloId || !tutorId)
    return NextResponse.json({ error: 'moduloId e tutorId são obrigatórios' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({ where: { id: moduloId } })
  if (!modulo || modulo.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  if (tutorId === session?.user?.id)
    return NextResponse.json({ error: 'O titular não pode ser co-tutor do próprio módulo' }, { status: 400 })

  const substituto = await prisma.usuario.findUnique({ where: { id: tutorId } })
  if (!substituto || substituto.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Usuário não encontrado ou não é tutor' }, { status: 404 })

  // Remove permissões antigas deste co-tutor no módulo
  await prisma.coTutorPermissao.deleteMany({ where: { moduloId, tutorId } })

  // Cria novas permissões
  const ids = Array.isArray(problemasIds) && problemasIds.length > 0 ? problemasIds : [null]
  await prisma.coTutorPermissao.createMany({
    data: ids.map((pid: string | null) => ({
      moduloId,
      tutorId,
      problemaId: pid ?? null,
    })),
    skipDuplicates: true,
  })

  const resultado = await prisma.coTutorPermissao.findMany({
    where:   { moduloId, tutorId },
    include: { tutor: { select: { id: true, nome: true, email: true } } },
  })

  return NextResponse.json({ ok: true, permissoes: resultado })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// Body: { moduloId, tutorId }
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
