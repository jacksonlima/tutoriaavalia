// src/app/(professor)/professor/modulos/novo/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { criarModuloSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

export async function criarModuloAction(dadosBrutos: any) {
  const session = await auth()
  
  if (!session) {
    return { sucesso: false, erro: 'Você precisa fazer login.' }
  }

  if (session.user.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso Negado: Apenas professores podem criar módulos.' }
  }

  const validacao = criarModuloSchema.safeParse(dadosBrutos)
  
  if (!validacao.success) {
    return { 
      sucesso: false, 
      erro: 'Preencha os campos corretamente.',
      errosDeCampo: validacao.error.flatten().fieldErrors 
    }
  }

  const dados = validacao.data

  try {
    const novoModulo = await prisma.modulo.create({
      data: {
        nome: dados.nome,
        ano: dados.ano,
        semestre: dados.semestre,
        tutoria: dados.tutoria,
        turma: dados.turma,
        tutorId: session.user.id, 
        
        // CORREÇÃO AQUI: Agora enviamos o e-mail E o número da chamada!
        matriculas: {
          create: dados.emailsAlunos.map((email, index) => ({
            usuario: { connect: { email } },
            numeraNaTurma: index + 1 
          }))
        },
        
        problemas: {
          create: dados.nomesProblemas.map((nome, index) => ({
            numero: index + 1,
            nome
          }))
        }
      }
    })

    revalidatePath('/professor/dashboard')

    return { sucesso: true, moduloId: novoModulo.id }
  } catch (error) {
    console.error("Erro ao salvar módulo:", error)
    return { sucesso: false, erro: 'Erro interno ao salvar no banco de dados.' }
  }
}