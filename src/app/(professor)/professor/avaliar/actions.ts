/**
 * TutoriaAvalia v2 — Server Actions: Avaliações do Tutor (v2)
 * Autor: Jackson Lima — CESUPA
 *
 * Correções:
 *   - podeAvaliar verifica tipoEncontro exato para co-tutores
 *   - Co-tutor não pode sobrescrever nota do titular
 */
'use server'

import { auth }                 from '@/lib/auth'
import { prisma }               from '@/lib/db'
import { avaliacaoTutorSchema } from '@/lib/validations'
import { revalidatePath }       from 'next/cache'

async function podeAvaliar(
  problemaId:   string,
  tipoEncontro: string,
  userId:       string
): Promise<{ permitido: boolean; eTitular: boolean }> {
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: true },
  })
  if (!problema) return { permitido: false, eTitular: false }

  if (problema.modulo.tutorId === userId)
    return { permitido: true, eTitular: true }

  // Co-tutor: verifica permissão exata com tipoEncontro
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

export async function salvarAvaliacoesTutor(dadosBrutos: unknown) {
  const session = await auth()
  if (!session?.user || session?.user?.papel !== 'TUTOR')
    return { sucesso: false, erro: 'Acesso negado.' }

  const result = avaliacaoTutorSchema.safeParse(dadosBrutos)
  if (!result.success)
    return { sucesso: false, erro: 'Dados inválidos.', detalhes: result.error.flatten() }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  const { permitido, eTitular } = await podeAvaliar(
    problemaId, tipoEncontro, session?.user?.id!
  )
  if (!permitido)
    return { sucesso: false, erro: 'Sem permissão para avaliar este encontro.' }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const resultados = []
      for (const av of avaliacoes) {
        if (eTitular) {
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
          // Co-tutor: não pode sobrescrever nota do titular
          const notaExistente = await tx.avaliacaoTutor.findUnique({
            where: {
              problemaId_avaliadoId_tipoEncontro: {
                problemaId, avaliadoId: av.avaliadoId, tipoEncontro,
              },
            },
          })
          if (!notaExistente) {
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
          } else {
            resultados.push(notaExistente)
          }
        }
      }
      return resultados
    })

    revalidatePath('/professor/avaliar')
    revalidatePath('/professor/dashboard')
    revalidatePath('/professor/relatorios')

    return { sucesso: true, quantidadeSalva: saved.length }
  } catch (error: any) {
    console.error('[salvarAvaliacoesTutor]', error)
    return { sucesso: false, erro: 'Erro interno ao salvar. Tente novamente.' }
  }
}

export async function getAvaliacoesTutor(problemaId: string, tipoEncontro: string) {
  const session = await auth()
  if (!session?.user || session?.user?.papel !== 'TUTOR')
    throw new Error('Acesso negado')

  const { permitido } = await podeAvaliar(problemaId, tipoEncontro, session?.user?.id!)
  if (!permitido)
    throw new Error('Sem permissão para visualizar este encontro')

  return prisma.avaliacaoTutor.findMany({
    where:   { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })
}
