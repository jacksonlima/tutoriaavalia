/**
 * TutoriaAvalia v2 — API: Avaliações do Tutor (v2)
 * Autor: Jackson Lima — CESUPA
 *
 * Correções de segurança:
 *   1. podeAvaliar verifica tipoEncontro específico (não só o problema)
 *   2. Co-tutor NÃO pode sobrescrever nota já lançada pelo titular
 */
import { auth }              from '@/lib/auth'
import { avaliacaoTutorSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Helper: verifica permissão granular ───────────────────────────────────────
async function podeAvaliar(
  prisma: any,
  problemaId:   string,
  tipoEncontro: string,
  userId:       string
): Promise<{ permitido: boolean; eTitular: boolean }> {
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: true },
  })
  if (!problema) return { permitido: false, eTitular: false }

  // Titular tem acesso total
  if (problema.modulo.tutorId === userId)
    return { permitido: true, eTitular: true }

  // Co-tutor: verifica permissão EXATA (problemaId + tipoEncontro)
  const permissao = await prisma.coTutorPermissao.findFirst({
    where: {
      tutorId:      userId,
      moduloId:     problema.modulo.id,
      problemaId:   problemaId,
      tipoEncontro: tipoEncontro as any,
    },
  })
  return { permitido: !!permissao, eTitular: false }
}

// ── POST /api/avaliacoes/tutor ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body   = await req.json()
  const result = avaliacaoTutorSchema.safeParse(body)
  if (!result.success)
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  const { permitido, eTitular } = await podeAvaliar(
    prisma, problemaId, tipoEncontro, session?.user?.id!
  )
  if (!permitido)
    return NextResponse.json({ error: 'Sem permissão para este encontro' }, { status: 403 })

  const saved = await prisma.$transaction(async (tx: any) => {
    const resultados = []
    for (const av of avaliacoes) {
      if (eTitular) {
        // Titular: upsert livre — pode sempre editar suas próprias notas
        const r = await tx.avaliacaoTutor.upsert({
          where: {
            problemaId_avaliadoId_tipoEncontro: {
              problemaId, avaliadoId: av.avaliadoId, tipoEncontro,
            },
          },
          update: {
            c1: av.c1, c2: av.c2, c3: av.c3,
            atitudes: av.atitudes,
            ativCompensatoria: av.ativCompensatoria,
            faltou: av.faltou ?? false,
          },
          create: {
            problemaId, avaliadoId: av.avaliadoId,
            tutorId: session?.user?.id!, tipoEncontro,
            c1: av.c1, c2: av.c2, c3: av.c3,
            atitudes: av.atitudes,
            ativCompensatoria: av.ativCompensatoria,
            faltou: av.faltou ?? false, finalizado: false,
          },
        })
        resultados.push(r)
      } else {
        // Co-tutor: só cria se o TITULAR ainda não avaliou este aluno
        const notaExistente = await tx.avaliacaoTutor.findUnique({
          where: {
            problemaId_avaliadoId_tipoEncontro: {
              problemaId, avaliadoId: av.avaliadoId, tipoEncontro,
            },
          },
        })

        if (notaExistente) {
          // Titular já avaliou → co-tutor NÃO pode sobrescrever
          // Retorna a nota existente sem erro (skip silencioso)
          resultados.push(notaExistente)
        } else {
          // Titular ainda não avaliou → co-tutor pode criar
          const r = await tx.avaliacaoTutor.create({
            data: {
              problemaId, avaliadoId: av.avaliadoId,
              tutorId: session?.user?.id!, tipoEncontro,
              c1: av.c1, c2: av.c2, c3: av.c3,
              atitudes: av.atitudes,
              ativCompensatoria: av.ativCompensatoria,
              faltou: av.faltou ?? false, finalizado: false,
            },
          })
          resultados.push(r)
        }
      }
    }
    return resultados
  })

  return NextResponse.json({ saved: saved.length })
}

// ── GET /api/avaliacoes/tutor ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const problemaId   = searchParams.get('problemaId')
  const tipoEncontro = searchParams.get('tipoEncontro')

  if (!problemaId || !tipoEncontro)
    return NextResponse.json({ error: 'problemaId e tipoEncontro são obrigatórios' }, { status: 400 })

  const { permitido } = await podeAvaliar(
    prisma, problemaId, tipoEncontro, session?.user?.id!
  )
  if (!permitido)
    return NextResponse.json({ error: 'Sem permissão para este encontro' }, { status: 403 })

  const avaliacoes = await prisma.avaliacaoTutor.findMany({
    where:   { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })

  return NextResponse.json(avaliacoes)
}
