import { auth } from '@/lib/auth'
import { avaliacaoTutorSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'


// Verifica se o usuário logado é titular OU co-tutor do módulo do problema
async function isTutorOuCoTutor(
  prisma: any,
  problemaId: string,
  userId: string
): Promise<boolean> {
  const problema = await prisma.problema.findUnique({
    where: { id: problemaId },
    include: { modulo: { include: { coTutores: true } } },
  })
  if (!problema) return false
  const modulo = problema.modulo
  if (modulo.tutorId === userId) return true
  return modulo.coTutores.some((ct: any) => ct.tutorId === userId)
}


export const dynamic = 'force-dynamic'

// POST /api/avaliacoes/tutor
// Salva (rascunho) ou finaliza as notas do tutor para um problema/encontro
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const result = avaliacaoTutorSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  // Verifica que o usuário é titular OU co-tutor (substituto) do módulo
  const autorizado = await isTutorOuCoTutor(prisma, problemaId, session.user.id)
  if (!autorizado) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  // Upsert de cada avaliação: professor pode salvar e sobrescrever quantas vezes quiser.
  // O campo 'finalizado' é mantido como false — não usamos mais travamento do lado do tutor.
  const saved = await prisma.$transaction(
    avaliacoes.map((av) =>
      prisma.avaliacaoTutor.upsert({
        where: {
          problemaId_avaliadoId_tipoEncontro: {
            problemaId,
            avaliadoId: av.avaliadoId,
            tipoEncontro,
          },
        },
        update: {
          c1:                av.c1,
          c2:                av.c2,
          c3:                av.c3,
          atitudes:          av.atitudes,
          ativCompensatoria: av.ativCompensatoria,
          // finalizado NÃO é atualizado aqui — não há mais travamento do tutor
        },
        create: {
          problemaId,
          avaliadoId:        av.avaliadoId,
          tutorId:           session.user.id,
          tipoEncontro,
          c1:                av.c1,
          c2:                av.c2,
          c3:                av.c3,
          atitudes:          av.atitudes,
          ativCompensatoria: av.ativCompensatoria,
          finalizado:        false, // sempre false — professor pode sempre editar
        },
      })
    )
  )

  return NextResponse.json({ saved: saved.length })
}

// GET /api/avaliacoes/tutor?problemaId=X&tipoEncontro=ABERTURA
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const problemaId = searchParams.get('problemaId')
  const tipoEncontro = searchParams.get('tipoEncontro') as 'ABERTURA' | 'FECHAMENTO' | null

  if (!problemaId || !tipoEncontro) {
    return NextResponse.json({ error: 'problemaId e tipoEncontro são obrigatórios' }, { status: 400 })
  }

  // Verifica acesso: titular ou co-tutor
  const autorizado = await isTutorOuCoTutor(prisma, problemaId, session.user.id)
  if (!autorizado) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const avaliacoes = await prisma.avaliacaoTutor.findMany({
    where: { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })

  return NextResponse.json(avaliacoes)
}
