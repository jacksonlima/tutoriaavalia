/**
 * TutoriaAvalia v2 — Server Actions: Editar Módulo
 * Autor: Jackson Lima — CESUPA
 *
 * Implementa segurança em 3 camadas:
 *   1. Autenticação (está logado?)
 *   2. Autorização de papel (é TUTOR?)
 *   3. Ownership (é o titular deste módulo?)
 *
 * Lógica completa de reconciliação de alunos e atualização de nomes de problemas
 * — fiel ao comportamento original da API PUT /api/modulos/[id].
 */
'use server'

import { auth }           from '@/lib/auth'
import { prisma }         from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Papel }          from '@prisma/client'
import { z }              from 'zod'

// Schema de validação inline para edição
const editarSchema = z.object({
  nome:           z.string().min(3, 'Nome muito curto'),
  ano:            z.number().int().min(2020).max(2100),
  semestre:       z.string().optional(),
  tutoria:        z.string().min(1, 'Selecione a tutoria'),
  turma:          z.string().min(1, 'Selecione a turma'),
  emailsAlunos:   z.array(z.string().email()).min(1).max(11),
  nomesProblemas: z.array(z.string().max(120)).optional(),
})

export async function editarModuloAction(moduloId: string, dadosBrutos: unknown) {
  // ── 1. Autenticação ────────────────────────────────────────────
  const session = await auth()
  if (!session?.user) {
    return { sucesso: false, erro: 'Você precisa fazer login.' }
  }

  // ── 2. Autorização de papel ────────────────────────────────────
  if (session?.user?.papel !== 'TUTOR') {
    return { sucesso: false, erro: 'Acesso negado: apenas professores podem editar módulos.' }
  }

  // ── 3. Ownership: verifica dono do módulo ─────────────────────
  const moduloNoBanco = await prisma.modulo.findUnique({
    where:   { id: moduloId },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, email: true } } },
        orderBy: { numeraNaTurma: 'asc' },
      },
    },
  })

  if (!moduloNoBanco) {
    return { sucesso: false, erro: 'Módulo não encontrado.' }
  }

  // Apenas o titular pode editar — co-tutores têm acesso somente leitura
  if (moduloNoBanco.tutorId !== session?.user?.id) {
    return { sucesso: false, erro: 'Acesso restrito: você não é o professor titular desta turma.' }
  }

  // ── 4. Validação Zod ──────────────────────────────────────────
  const validacao = editarSchema.safeParse(dadosBrutos)
  if (!validacao.success) {
    const erros = validacao.error.flatten()
    return { sucesso: false, erro: 'Dados inválidos.', errosDeCampo: erros.fieldErrors }
  }

  const { nome, ano, semestre, tutoria, turma, emailsAlunos, nomesProblemas } = validacao.data

  // ── 5. Garante que todos os alunos existam no banco ───────────
  const alunosNovos = await Promise.all(
    emailsAlunos.map((email) =>
      prisma.usuario.upsert({
        where:  { email },
        update: {},
        create: { email, nome: email.split('@')[0], papel: Papel.ALUNO },
      })
    )
  )

  // ── 6. Transação: atualiza módulo, alunos e problemas ────────
  try {
    await prisma.$transaction(async (tx) => {
      // 6a. Atualiza dados básicos do módulo
      await tx.modulo.update({
        where: { id: moduloId },
        data:  { nome, ano, semestre: semestre ?? '01', tutoria, turma },
      })

      // 6b. Atualiza nomes dos problemas existentes
      if (Array.isArray(nomesProblemas)) {
        for (let i = 0; i < moduloNoBanco.problemas.length; i++) {
          const prob    = moduloNoBanco.problemas[i]
          const novoNome = (nomesProblemas[i] ?? '').trim()
          await tx.problema.update({
            where: { id: prob.id },
            data:  { nome: novoNome || `Problema ${String(prob.numero).padStart(2, '0')}` },
          })
        }
      }

      // 6c. Reconciliar lista de alunos (add/remove)
      const emailsAtuais    = moduloNoBanco.matriculas.map((m) => m.usuario.email)
      const emailsDesejados = emailsAlunos.map((e) => e.toLowerCase().trim())

      // Remove alunos que saíram da lista
      const emailsRemover = emailsAtuais.filter((e) => !emailsDesejados.includes(e))
      for (const email of emailsRemover) {
        const mat = moduloNoBanco.matriculas.find((m) => m.usuario.email === email)
        if (mat) {
          await tx.matricula.deleteMany({ where: { moduloId, usuarioId: mat.usuario.id } })
        }
      }

      // Adiciona alunos novos que ainda não têm matrícula
      let proximoNumero = moduloNoBanco.matriculas.length + 1
      const emailsExistentes = emailsAtuais.filter((e) => emailsDesejados.includes(e))
      for (const aluno of alunosNovos) {
        if (!emailsExistentes.includes(aluno.email)) {
          await tx.matricula.create({
            data: { moduloId, usuarioId: aluno.id, numeraNaTurma: proximoNumero++ },
          })
        }
      }

      // Reordena numeraNaTurma conforme nova ordem da lista
      for (let i = 0; i < alunosNovos.length; i++) {
        await tx.matricula.updateMany({
          where: { moduloId, usuarioId: alunosNovos[i].id },
          data:  { numeraNaTurma: i + 1 },
        })
      }
    })

    // ── 7. Invalida caches ────────────────────────────────────────
    revalidatePath('/professor/dashboard')
    revalidatePath(`/professor/modulos/${moduloId}/editar`)

    return { sucesso: true }

  } catch (error: any) {
    console.error('[editarModuloAction]', error)
    return { sucesso: false, erro: 'Erro interno ao salvar. Tente novamente.' }
  }
}
