/**
 * TutoriaAvalia v2 — Server Actions: Avaliações do Tutor
 * Autor: Jackson Lima — CESUPA
 *
 * Substitui as chamadas REST POST/GET em /api/avaliacoes/tutor por Server Actions.
 * A lógica de segurança (autenticação + papel + permissão granular por co-tutor)
 * é idêntica à implementação original da API Route.
 */
'use server'

import { auth }                  from '@/lib/auth'
import { prisma }                from '@/lib/db'
import { avaliacaoTutorSchema }  from '@/lib/validations'
import { revalidatePath }        from 'next/cache'

// ── Helper: verifica se userId pode avaliar aquele problema/tipo ──────────────
// Titular do módulo → acesso total
// Co-tutor          → acesso apenas às permissões definidas pelo titular
async function podeAvaliar(
  problemaId:   string,
  tipoEncontro: string,
  userId:       string
): Promise<boolean> {
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: {
      modulo: {
        include: {
          coTutores: {
            where:   { tutorId: userId },
            include: { permissoes: true },
          },
        },
      },
    },
  })
  if (!problema) return false
  if (problema.modulo.tutorId === userId) return true
  const ct = problema.modulo.coTutores[0]
  if (!ct) return false
  return ct.permissoes.some(
    (p: any) => p.problemaId === problemaId && p.tipoEncontro === tipoEncontro
  )
}

// ── SALVAR AVALIAÇÕES (substitui POST /api/avaliacoes/tutor) ─────────────────
export async function salvarAvaliacoesTutor(dadosBrutos: unknown) {
  // 1. Autenticação
  const session = await auth()
  if (!session?.user || session.user.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso negado.' }
  }

  // 2. Validação Zod
  const result = avaliacaoTutorSchema.safeParse(dadosBrutos)
  if (!result.success) {
    return { sucesso: false, erro: 'Dados inválidos.', detalhes: result.error.flatten() }
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  // 3. Autorização granular (titular ou co-tutor com permissão)
  const autorizado = await podeAvaliar(problemaId, tipoEncontro, session.user.id)
  if (!autorizado) {
    return { sucesso: false, erro: 'Sem permissão para avaliar este encontro.' }
  }

  // 4. Salva no banco (upsert — professor pode salvar várias vezes)
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
            tutorId:           session.user.id,
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

    // 5. Invalida caches relevantes
    revalidatePath('/professor/avaliar')
    revalidatePath('/professor/dashboard')
    revalidatePath('/professor/relatorios')

    return { sucesso: true, quantidadeSalva: saved.length }

  } catch (error: any) {
    console.error('[salvarAvaliacoesTutor]', error)
    return { sucesso: false, erro: 'Erro interno ao salvar. Tente novamente.' }
  }
}

// ── BUSCAR AVALIAÇÕES (substitui GET /api/avaliacoes/tutor) ──────────────────
// Nota: esta função é chamada via Server Action no useEffect do cliente.
// Para dados iniciais em Server Components, prefira buscar direto no page.tsx.
export async function getAvaliacoesTutor(problemaId: string, tipoEncontro: string) {
  const session = await auth()
  if (!session?.user || session.user.papel !== 'TUTOR') {
    throw new Error('Acesso negado')
  }

  const autorizado = await podeAvaliar(problemaId, tipoEncontro, session.user.id)
  if (!autorizado) {
    throw new Error('Sem permissão para visualizar este encontro')
  }

  const avaliacoes = await prisma.avaliacaoTutor.findMany({
    where:   { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })

  return avaliacoes
}
