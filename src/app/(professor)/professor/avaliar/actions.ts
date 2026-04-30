/**
 * TutoriaAvalia v2 — Server Actions: Avaliações do Tutor
 * Autor: Jackson Lima — CESUPA
 */
'use server'

import { auth }                 from '@/lib/auth'
import { prisma }               from '@/lib/db'
import { avaliacaoTutorSchema } from '@/lib/validations'
import { revalidatePath }       from 'next/cache'

// ── Verifica se userId pode avaliar aquele problema/tipo ──────────────────────
// Usa CoTutorPermissao (único model de co-tutores no schema atual)
async function podeAvaliar(
  problemaId:   string,
  tipoEncontro: string,
  userId:       string
): Promise<boolean> {
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: true },
  })
  if (!problema) return false

  // Titular tem acesso total
  if (problema.modulo.tutorId === userId) return true

  // Co-tutor: busca permissão em CoTutorPermissao
  // problemaId=null → acesso geral ao módulo
  // problemaId=X    → acesso específico a este problema
  const permissao = await prisma.coTutorPermissao.findFirst({
    where: {
      tutorId:  userId,
      moduloId: problema.modulo.id,
      OR: [
        { problemaId: null },
        { problemaId: problemaId },
      ],
    },
  })
  return !!permissao
}

// ── SALVAR AVALIAÇÕES ─────────────────────────────────────────────────────────
export async function salvarAvaliacoesTutor(dadosBrutos: unknown) {
  const session = await auth()
  if (!session?.user || session?.user?.papel !== 'TUTOR')
    return { sucesso: false, erro: 'Acesso negado.' }

  const result = avaliacaoTutorSchema.safeParse(dadosBrutos)
  if (!result.success)
    return { sucesso: false, erro: 'Dados inválidos.', detalhes: result.error.flatten() }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  const autorizado = await podeAvaliar(problemaId, tipoEncontro, session?.user?.id!)
  if (!autorizado)
    return { sucesso: false, erro: 'Sem permissão para avaliar este encontro.' }

  try {
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

    revalidatePath('/professor/avaliar')
    revalidatePath('/professor/dashboard')
    revalidatePath('/professor/relatorios')

    return { sucesso: true, quantidadeSalva: saved.length }
  } catch (error: any) {
    console.error('[salvarAvaliacoesTutor]', error)
    return { sucesso: false, erro: 'Erro interno ao salvar. Tente novamente.' }
  }
}

// ── BUSCAR AVALIAÇÕES ─────────────────────────────────────────────────────────
export async function getAvaliacoesTutor(problemaId: string, tipoEncontro: string) {
  const session = await auth()
  if (!session?.user || session?.user?.papel !== 'TUTOR')
    throw new Error('Acesso negado')

  const autorizado = await podeAvaliar(problemaId, tipoEncontro, session?.user?.id!)
  if (!autorizado)
    throw new Error('Sem permissão para visualizar este encontro')

  return prisma.avaliacaoTutor.findMany({
    where:   { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })
}
