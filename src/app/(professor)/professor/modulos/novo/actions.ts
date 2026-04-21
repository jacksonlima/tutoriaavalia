/**
 * TutoriaAvalia v2 — Server Actions: Criar Módulo
 * Autor: Jackson Lima — CESUPA
 *
 * 'use server' transforma estas funções em endpoints seguros do servidor.
 * O código NUNCA é enviado ao browser — roda exclusivamente no servidor.
 */
'use server'

import { auth }             from '@/lib/auth'
import { prisma }           from '@/lib/db'
import { criarModuloSchema } from '@/lib/validations'
import { revalidatePath }   from 'next/cache'
import { Papel }            from '@prisma/client'

export async function criarModuloAction(dadosBrutos: unknown) {
  // ── 1. Autenticação ────────────────────────────────────────────
  const session = await auth()
  if (!session?.user) {
    return { sucesso: false, erro: 'Você precisa fazer login.' }
  }

  // ── 2. Autorização de papel ────────────────────────────────────
  if (session?.user?.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso negado: apenas professores podem criar módulos.' }
  }

  // ── 3. Validação Zod ──────────────────────────────────────────
  const validacao = criarModuloSchema.safeParse(dadosBrutos)
  if (!validacao.success) {
    const erros = validacao.error.flatten()
    const primeiroErro =
      Object.values(erros.fieldErrors).flat()[0] ??
      'Preencha todos os campos corretamente.'
    return { sucesso: false, erro: primeiroErro, errosDeCampo: erros.fieldErrors }
  }

  const {
    nome, ano, semestre, tutoria, turma,
    emailsAlunos, nomesProblemas,
    quantidadeProblemas,
    temSaltoTriplo, problemasSaltoTriplo,
  } = validacao.data

  // ── 4. Garante que todos os alunos existam no banco ───────────
  const alunos = await Promise.all(
    emailsAlunos.map((email) =>
      prisma.usuario.upsert({
        where:  { email },
        update: {},
        create: { email, nome: email.split('@')[0], papel: Papel.ALUNO },
      })
    )
  )

  // Conjunto de números de problema com Salto Triplo
  const saltoSet = new Set(problemasSaltoTriplo ?? [])

  // ── 5. Transação: cria módulo, problemas e matrículas ────────
  try {
    const novoModulo = await prisma.$transaction(async (tx) => {
      const modulo = await tx.modulo.create({
        data: { nome, ano, semestre, tutoria, turma, tutorId: session?.user?.id },
      })

      // Cria problemas com suporte completo ao Salto Triplo
      for (let i = 0; i < quantidadeProblemas; i++) {
        const numProb  = i + 1
        const comSalto = temSaltoTriplo && saltoSet.has(numProb)
        const nomeProb = nomesProblemas?.[i]?.trim() ||
          `Problema ${String(numProb).padStart(2, '0')}`

        await tx.problema.create({
          data: {
            moduloId:        modulo.id,
            numero:          numProb,
            nome:            nomeProb,
            temSaltoTriplo:  comSalto,
            // Todos os encontros iniciam desativados — professor ativa um a um
            aberturaAtiva:   false,
            fechamentoAtivo: false,
            fechamentoAAtivo: false,
            fechamentoBAtivo: false,
          },
        })
      }

      // Cria matrículas com numeração de chamada
      for (let i = 0; i < alunos.length; i++) {
        await tx.matricula.create({
          data: {
            moduloId:     modulo.id,
            usuarioId:    alunos[i].id,
            numeraNaTurma: i + 1,
          },
        })
      }

      return modulo
    })

    // ── 6. Invalida o cache do dashboard ─────────────────────────
    revalidatePath('/professor/dashboard')

    return { sucesso: true, moduloId: novoModulo.id }

  } catch (error: any) {
    console.error('[criarModuloAction]', error)
    // Erro de constraint único: módulo duplicado
    if (error?.code === 'P2002') {
      return { sucesso: false, erro: 'Já existe um módulo com esta combinação de ano, tutoria e turma.' }
    }
    return { sucesso: false, erro: 'Erro interno ao salvar. Tente novamente.' }
  }
}
