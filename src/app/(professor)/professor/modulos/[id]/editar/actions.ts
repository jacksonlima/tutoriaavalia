/**
 * Notas da Tutoria v2 — Server Actions: Editar Módulo
 * Autor: Jackson Lima — CESUPA
 *
 * FIX P2002: reordenação usa UPDATE...CASE (uma query só) em vez de
 * N updateMany() individuais — evita colisão na constraint e
 * FIX P2028: evita transações longas com pgBouncer (Neon)
 */
'use server'

import { auth }          from '@/lib/auth'
import { prisma }        from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Papel }         from '@prisma/client'
import { z }             from 'zod'

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
  // 1. Autenticação
  const session = await auth()
  if (!session?.user)
    return { sucesso: false, erro: 'Você precisa fazer login.' }

  // 2. Autorização de papel
  if (session?.user?.papel !== 'TUTOR')
    return { sucesso: false, erro: 'Acesso negado: apenas professores podem editar módulos.' }

  // 3. Ownership
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

  if (!moduloNoBanco)
    return { sucesso: false, erro: 'Módulo não encontrado.' }

  if (moduloNoBanco.tutorId !== session?.user?.id)
    return { sucesso: false, erro: 'Acesso restrito: você não é o professor titular desta turma.' }

  // 4. Validação Zod
  const validacao = editarSchema.safeParse(dadosBrutos)
  if (!validacao.success) {
    const erros = validacao.error.flatten()
    return { sucesso: false, erro: 'Dados inválidos.', errosDeCampo: erros.fieldErrors }
  }

  const { nome, ano, semestre, tutoria, turma, emailsAlunos, nomesProblemas } = validacao.data

  // 5. Garante que todos os alunos existam no banco
  const alunosNovos = await Promise.all(
    emailsAlunos.map((email) =>
      prisma.usuario.upsert({
        where:  { email },
        update: {},
        create: { email, nome: email.split('@')[0], papel: Papel.ALUNO },
      })
    )
  )

  try {
    // 6a. Atualiza dados básicos do módulo
    await prisma.modulo.update({
      where: { id: moduloId },
      data:  { nome, ano, semestre: semestre ?? '01', tutoria, turma },
    })

    // 6b. Atualiza nomes dos problemas
    if (Array.isArray(nomesProblemas)) {
      for (let i = 0; i < moduloNoBanco.problemas.length; i++) {
        const prob     = moduloNoBanco.problemas[i]
        const novoNome = (nomesProblemas[i] ?? '').trim()
        await prisma.problema.update({
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
        await prisma.matricula.deleteMany({
          where: { moduloId, usuarioId: mat.usuario.id },
        })
      }
    }

    // Adiciona alunos novos que ainda não têm matrícula
    let proximoNumero      = moduloNoBanco.matriculas.length + 1
    const emailsExistentes = emailsAtuais.filter((e) => emailsDesejados.includes(e))
    for (const aluno of alunosNovos) {
      if (!emailsExistentes.includes(aluno.email)) {
        await prisma.matricula.create({
          data: { moduloId, usuarioId: aluno.id, numeraNaTurma: proximoNumero++ },
        })
      }
    }

    // 6d. Reordena numeraNaTurma com UPDATE...CASE em UMA única query
    //
    // FIX P2002 + P2028:
    // - Evita colisão de constraint (não há momento em que dois alunos
    //   têm o mesmo número simultaneamente)
    // - Uma query só → não sobrecarrega a transação do pgBouncer (Neon)
    //
    // SQL gerado:
    //   UPDATE matriculas
    //   SET numero_na_turma = CASE usuario_id
    //     WHEN 'id1' THEN 1001   ← passo 1: offset temporário
    //     WHEN 'id2' THEN 1002
    //     ...
    //   END
    //   WHERE modulo_id = '...' AND usuario_id IN (...)
    //
    // Seguido de:
    //   UPDATE ... SET numero_na_turma = numero_na_turma - 1000
    //   WHERE modulo_id = '...' AND usuario_id IN (...)

    if (alunosNovos.length > 0) {
      const ids = alunosNovos.map((a) => a.id)

      // Passo 1: move para offset temporário com UPDATE...CASE (1 query)
      const casePasso1 = alunosNovos
        .map((a, i) => `WHEN '${a.id}' THEN ${1000 + i + 1}`)
        .join(' ')

      await prisma.$executeRawUnsafe(`
        UPDATE matriculas
        SET numero_na_turma = CASE usuario_id ${casePasso1} END
        WHERE modulo_id = '${moduloId}'
          AND usuario_id IN (${ids.map((id) => `'${id}'`).join(',')})
      `)

      // Passo 2: subtrai o offset (1 query)
      await prisma.$executeRawUnsafe(`
        UPDATE matriculas
        SET numero_na_turma = numero_na_turma - 1000
        WHERE modulo_id = '${moduloId}'
          AND usuario_id IN (${ids.map((id) => `'${id}'`).join(',')})
      `)
    }

    // 7. Invalida caches
    revalidatePath('/professor/dashboard')
    revalidatePath(`/professor/modulos/${moduloId}/editar`)

    return { sucesso: true }

  } catch (error: any) {
    console.error('[editarModuloAction]', error)
    return { sucesso: false, erro: 'Erro interno ao salvar. Tente novamente.' }
  }
}
