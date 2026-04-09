'use server'

// O 'use server' no topo transforma todas as funções deste arquivo em endpoints 
// invisíveis e altamente otimizados da Vercel.

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { avaliacaoTutorSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

// Mantemos sua função de segurança, mas agora ela usa o prisma importado globalmente
async function podeAvaliar(
  problemaId: string,
  tipoEncontro: string,
  userId: string
): Promise<boolean> {
  const problema = await prisma.problema.findUnique({
    where: { id: problemaId },
    include: {
      modulo: {
        include: {
          coTutores: {
            where: { tutorId: userId },
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

// ------------------------------------------------------------------
// Ação que substitui o método POST (Salvar Avaliações)
// ------------------------------------------------------------------
export async function salvarAvaliacoesTutor(dadosBrutos: any) {
  const session = await auth()
  
  if (!session || session.user.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso negado. Você não é um tutor.' }
  }

  // 1. Validação com Zod
  const result = avaliacaoTutorSchema.safeParse(dadosBrutos)
  if (!result.success) {
    return { sucesso: false, erro: 'Dados inválidos.', detalhes: result.error.flatten() }
  }

  const { problemaId, tipoEncontro, avaliacoes } = result.data

  // 2. Validação de Autorização (Prevenção de Hackers)
  const autorizado = await podeAvaliar(problemaId, tipoEncontro, session.user.id)
  if (!autorizado) {
    return { sucesso: false, erro: 'Sem permissão para avaliar este encontro.' }
  }

  try {
    // 3. Salva no banco de dados
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
            c1: av.c1,
            c2: av.c2,
            c3: av.c3,
            atitudes: av.atitudes,
            ativCompensatoria: av.ativCompensatoria,
            faltou: av.faltou ?? false,
          },
          create: {
            problemaId,
            avaliadoId: av.avaliadoId,
            tutorId: session.user.id,
            tipoEncontro,
            c1: av.c1,
            c2: av.c2,
            c3: av.c3,
            atitudes: av.atitudes,
            ativCompensatoria: av.ativCompensatoria,
            faltou: av.faltou ?? false,
            finalizado: false, 
          },
        })
      )
    )

    // 4. O Pulo do Gato: Limpa o cache da Vercel!
    // Isso faz a tela do tutor se atualizar instantaneamente após salvar.
    revalidatePath('/professor/avaliar')
    revalidatePath('/professor/dashboard')

    return { sucesso: true, quantidadeSalva: saved.length }

  } catch (error) {
    console.error("Erro ao salvar:", error)
    return { sucesso: false, erro: 'Erro interno ao salvar no banco de dados.' }
  }
}

// ------------------------------------------------------------------
// Função que substitui o método GET (Buscar Avaliações)
// ------------------------------------------------------------------
export async function getAvaliacoesTutor(problemaId: string, tipoEncontro: string) {
  const session = await auth()
  
  if (!session || session.user.papel !== 'TUTOR') {
    throw new Error('Acesso negado')
  }

  const autorizado = await podeAvaliar(problemaId, tipoEncontro, session.user.id)
  if (!autorizado) {
    throw new Error('Sem permissão para visualizar este encontro')
  }

  const avaliacoes = await prisma.avaliacaoTutor.findMany({
    where: { problemaId, tipoEncontro },
    include: { avaliado: { select: { id: true, nome: true } } },
    orderBy: { avaliado: { nome: 'asc' } },
  })

  return avaliacoes
}