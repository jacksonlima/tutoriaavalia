// src/app/(professor)/professor/modulos/novo/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { criarModuloSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

export async function criarModuloAction(dadosBrutos: any) {
  const session = await auth()
  
  // 1. AUTENTICAÇÃO: O usuário está logado?
  if (!session) {
    return { sucesso: false, erro: 'Você precisa fazer login.' }
  }

  // 2. AUTORIZAÇÃO (O Passo 5!): É um Tutor? (Alunos espertinhos param aqui)
  if (session.user.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso Negado: Apenas professores podem criar módulos.' }
  }

  // 3. VALIDAÇÃO ZOD: Garante que os dados estão no formato perfeito
  const validacao = criarModuloSchema.safeParse(dadosBrutos)
  
  if (!validacao.success) {
    // Se o Zod achar erros, devolvemos para o Frontend mostrar em vermelho
    return { 
      sucesso: false, 
      erro: 'Preencha os campos corretamente.',
      errosDeCampo: validacao.error.flatten().fieldErrors 
    }
  }

  // Se passou de tudo, temos certeza que os dados estão limpos e perfeitos!
  const dados = validacao.data

  try {
    // 4. Salva no banco de dados Neon
    const novoModulo = await prisma.modulo.create({
      data: {
        nome: dados.nome,
        ano: dados.ano,
        semestre: dados.semestre,
        tutoria: dados.tutoria,
        turma: dados.turma,
        tutorId: session.user.id, // O dono do módulo!
        
        // Cria as matrículas dos alunos
        matriculas: {
          create: dados.emailsAlunos.map(email => ({
            usuario: { connect: { email } }
          }))
        },
        
        // Cria os problemas
        problemas: {
          create: dados.nomesProblemas.map((nome, index) => ({
            numero: index + 1,
            nome
          }))
        }
      }
    })

    // 5. Atualiza o painel do professor para o módulo novo aparecer instantaneamente
    revalidatePath('/professor/dashboard')

    return { sucesso: true, moduloId: novoModulo.id }
  } catch (error) {
    console.error("Erro ao salvar módulo:", error)
    return { sucesso: false, erro: 'Erro interno ao salvar no banco de dados.' }
  }
}