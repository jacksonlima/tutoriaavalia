// src/app/(professor)/professor/modulos/[id]/editar/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { editarModuloSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

export async function editarModuloAction(moduloId: string, dadosBrutos: any) {
  const session = await auth()
  
  // 1. AUTENTICAÇÃO: O usuário está logado?
  if (!session) {
    return { sucesso: false, erro: 'Você precisa fazer login.' }
  }

  // 2. AUTORIZAÇÃO DE PAPEL: É um Tutor? (Alunos espertinhos param aqui)
  if (session.user.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso Negado: Apenas professores podem editar.' }
  }

  // 3. A SUPER TRAVA DE SEGURANÇA (Verificando o Dono real)
  // Vamos no banco de dados perguntar: "De quem é este módulo?"
  const moduloNoBanco = await prisma.modulo.findUnique({
    where: { id: moduloId },
    select: { tutorId: true } // Puxa SÓ a identidade do dono para economizar memória
  })

  // Se o módulo foi deletado ou não existe
  if (!moduloNoBanco) {
    return { sucesso: false, erro: 'Módulo não encontrado no sistema.' }
  }

  // AQUI ACONTECE A MÁGICA: O id do logado bate com o dono do módulo?
  if (moduloNoBanco.tutorId !== session.user.id) {
    // Tentativa de HACKER ou professor bisbilhoteiro!
    return { 
      sucesso: false, 
      erro: 'Acesso Restrito: Você não é o professor titular desta turma. Edição bloqueada!' 
    }
  }

  // 4. VALIDAÇÃO ZOD: Se chegou até aqui, é o dono verdadeiro. Vamos checar se os dados tão certos.
  const validacao = editarModuloSchema.safeParse(dadosBrutos)
  if (!validacao.success) {
    return { 
      sucesso: false, 
      erro: 'Preencha os campos corretamente.',
      errosDeCampo: validacao.error.flatten().fieldErrors 
    }
  }

  const dados = validacao.data

  try {
    // 5. ATUALIZA NO BANCO
    // Atenção: Esta é a atualização básica. Se você tiver lógica complexa para 
    // atualizar os emailsAlunos e problemas que ficava lá no seu antigo 
    // arquivo api/modulos/[id]/route.ts, você deve colar essa lógica do Prisma aqui!
    await prisma.modulo.update({
      where: { id: moduloId },
      data: {
        nome: dados.nome,
        ano: dados.ano,
        semestre: dados.semestre,
        tutoria: dados.tutoria,
        turma: dados.turma,
      }
    })

    // 6. Atualiza as telas para o professor ver a mudança na hora
    revalidatePath('/professor/dashboard')
    revalidatePath(`/professor/modulos/${moduloId}/editar`)

    return { sucesso: true }
  } catch (error) {
    console.error("Erro ao editar módulo:", error)
    return { sucesso: false, erro: 'Erro interno ao salvar no banco de dados.' }
  }
}