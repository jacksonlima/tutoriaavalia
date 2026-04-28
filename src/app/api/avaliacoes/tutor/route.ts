import { auth }              from '@/lib/auth'
import { avaliacaoTutorSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Verifica se userId pode avaliar aquele problema/encontro ──────────────────
// Titular do módulo: acesso total
// Co-tutor: verifica CoTutorPermissao (registro com problemaId=null = módulo inteiro)
async function podeAvaliar(
  prisma: any,
  problemaId: string,
  tipoEncontro: string,
  userId: string
): Promise<boolean> {
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: true },
  })
  if (!problema) return false

  // Titular tem acesso total
  if (problema.modulo.tutorId === userId) return true

  // Co-tutor: verifica CoTutorPermissao
  const permissao = await prisma.coTutorPermissao.findFirst({
    where: {
      tutorId:  userId,
      moduloId: problema.modulo.id,
      OR: [
        { problemaId: null },        // permissão geral no módulo
        { problemaId: problemaId },  // permissão específica neste problema
      ],
    },
  })
  return !!permissao
}

// Compatibilidade: verifica apenas se é tutor ou co-tutor (sem tipoEncontro)
async function isTutorOuCoTutor(
  prisma: any,
  problemaId: string,
  userId: string
): Promise<boolean> {
  return podeAvaliar(prisma, problemaId, 'ABERTURA', userId)
}

// ── POST /api/avaliacoes/tutor ────────────────────────────────────────────────
// Salva (rascunho) as notas do tutor para um problema/encontro.
// O professor pode salvar e sobrescrever quantas vezes quiser.
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body   = await req.json()
  const result = avaliacaoTutorSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  const autorizado = await podeAvaliar(prisma, problemaId, tipoEncontro, session?.user?.id!)
  if (!autorizado) {
    return NextResponse.json({ error: 'Sem permissão para este encontro' }, { status: 403 })
  }

  const saved = await prisma.$transaction(
    avaliacoes.map((av) =>
      prisma.avaliacaoTutor.upsert({
        where: {
          problemaId_avaliadoId_tipoEncontro: {
            problemaId,
            avaliadoId:   av.avaliadoId,
            tipoEncontro,
          },
        },
        update: {
          c1:                av.c1,
          c2:                av.c2,
          c3:                av.c3,
          atitudes:          av.atitudes,
          ativCompensatoria: av.ativCompensatoria,
          faltou:            av.faltou ?? false,
        },
        create: {
          problemaId,
          avaliadoId:        av.avaliadoId,
          tutorId:           session?.user?.id!,
          tipoEncontro,
          c1:                av.c1,
          c2:                av.c2,
          c3:                av.c3,
          atitudes:          av.atitudes,
          ativCompensatoria: av.ativCompensatoria,
          faltou:            av.faltou ?? false,
          finalizado:        false,
        },
      })
    )
  )

  return NextResponse.json({ saved: saved.length })
}

// ── GET /api/avaliacoes/tutor?problemaId=X&tipoEncontro=ABERTURA ──────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const problemaId   = searchParams.get('problemaId')
  const tipoEncontro = searchParams.get('tipoEncontro') as 'ABERTURA' | 'FECHAMENTO' | null

  if (!problemaId || !tipoEncontro) {
    return NextResponse.json({ error: 'problemaId e tipoEncontro são obrigatórios' }, { status: 400 })
  }

  const autorizado = await podeAvaliar(prisma, problemaId, tipoEncontro, session?.user?.id!)
  if (!autorizado) {
    return NextResponse.json({ error: 'Sem permissão para este encontro' }, { status: 403 })
  }

  const avaliacoes = await prisma.avaliacaoTutor.findMany({
    where:   { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })

  return NextResponse.json(avaliacoes)
}
