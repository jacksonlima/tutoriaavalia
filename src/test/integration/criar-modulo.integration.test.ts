/**
 * Integração: criação de módulo (espelha src/app/(professor)/.../novo/actions.ts)
 *
 * Foco: garantir que a transação `criarModuloAction` cria corretamente
 * módulo + problemas + matrículas e respeita as constraints do schema.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { Papel } from '@prisma/client'
import { testPrisma, truncateAll } from '../db'
import { seedTutor } from '../helpers'

beforeEach(async () => {
  await truncateAll()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

/**
 * Helper que reproduz a parte de banco do `criarModuloAction`,
 * sem auth/Zod (já cobertos por outros testes).
 */
async function criarModulo(params: {
  tutorId: string
  emailsAlunos: string[]
  qtdProblemas: number
  nomesProblemas?: string[]
  ano?: number
  tutoria?: string
  turma?: string
}) {
  const alunos = await Promise.all(
    params.emailsAlunos.map((email) =>
      testPrisma.usuario.upsert({
        where: { email },
        update: {},
        create: { email, nome: email.split('@')[0], papel: Papel.ALUNO },
      })
    )
  )

  return testPrisma.$transaction(async (tx) => {
    const modulo = await tx.modulo.create({
      data: {
        nome: 'III - Ataque e Defesa',
        ano: params.ano ?? 2026,
        semestre: '01',
        tutoria: params.tutoria ?? 'Tutoria 1',
        turma: params.turma ?? 'MD1',
        tutorId: params.tutorId,
      },
    })

    for (let i = 0; i < params.qtdProblemas; i++) {
      await tx.problema.create({
        data: {
          moduloId: modulo.id,
          numero: i + 1,
          nome: params.nomesProblemas?.[i] ?? `Problema ${i + 1}`,
        },
      })
    }

    for (let i = 0; i < alunos.length; i++) {
      await tx.matricula.create({
        data: {
          moduloId: modulo.id,
          usuarioId: alunos[i].id,
          numeraNaTurma: i + 1,
        },
      })
    }

    return modulo
  })
}

describe('Criação de módulo (integração)', () => {
  it('cria módulo, problemas e matrículas em uma transação', async () => {
    const tutor = await seedTutor()

    const modulo = await criarModulo({
      tutorId: tutor.id,
      emailsAlunos: ['a1@aluno.cesupa.br', 'a2@aluno.cesupa.br', 'a3@aluno.cesupa.br'],
      qtdProblemas: 5,
    })

    const problemas = await testPrisma.problema.findMany({
      where: { moduloId: modulo.id },
      orderBy: { numero: 'asc' },
    })
    const matriculas = await testPrisma.matricula.findMany({
      where: { moduloId: modulo.id },
      orderBy: { numeraNaTurma: 'asc' },
    })

    expect(problemas).toHaveLength(5)
    expect(problemas.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5])
    expect(matriculas).toHaveLength(3)
    expect(matriculas.map((m) => m.numeraNaTurma)).toEqual([1, 2, 3])
  })

  it('faz upsert de aluno por email — não duplica se já existir', async () => {
    const tutor = await seedTutor()

    // Cria o módulo 1 com aluno
    await criarModulo({
      tutorId: tutor.id,
      emailsAlunos: ['mesmo@aluno.cesupa.br'],
      qtdProblemas: 1,
      tutoria: 'Tutoria 1',
      turma: 'MD1',
    })
    // Cria módulo 2 reaproveitando o mesmo aluno
    await criarModulo({
      tutorId: tutor.id,
      emailsAlunos: ['mesmo@aluno.cesupa.br'],
      qtdProblemas: 1,
      tutoria: 'Tutoria 2',
      turma: 'MD2',
    })

    const alunos = await testPrisma.usuario.findMany({
      where: { email: 'mesmo@aluno.cesupa.br' },
    })
    expect(alunos).toHaveLength(1) // upsert deduplicou
  })

  it('rejeita módulo duplicado (constraint ano+tutoria+turma+tutor)', async () => {
    const tutor = await seedTutor()

    await criarModulo({
      tutorId: tutor.id,
      emailsAlunos: ['a@aluno.cesupa.br'],
      qtdProblemas: 1,
      ano: 2026,
      tutoria: 'Tutoria 3',
      turma: 'MD5',
    })

    await expect(
      criarModulo({
        tutorId: tutor.id,
        emailsAlunos: ['b@aluno.cesupa.br'],
        qtdProblemas: 1,
        ano: 2026,
        tutoria: 'Tutoria 3',
        turma: 'MD5',
      })
    ).rejects.toThrow(/Unique constraint|P2002/i)
  })

  it('rejeita matrícula duplicada do mesmo aluno no mesmo módulo', async () => {
    const tutor = await seedTutor()

    await expect(
      criarModulo({
        tutorId: tutor.id,
        // Mesmo email duas vezes no array
        emailsAlunos: ['dup@aluno.cesupa.br', 'dup@aluno.cesupa.br'],
        qtdProblemas: 1,
      })
    ).rejects.toThrow(/Unique constraint|P2002/i)
  })

  it('aceita o mesmo aluno em módulos diferentes', async () => {
    const tutor = await seedTutor()
    const email = 'compartilhado@aluno.cesupa.br'

    await criarModulo({
      tutorId: tutor.id,
      emailsAlunos: [email],
      qtdProblemas: 1,
      tutoria: 'Tutoria 1',
      turma: 'MD1',
    })
    await criarModulo({
      tutorId: tutor.id,
      emailsAlunos: [email],
      qtdProblemas: 1,
      tutoria: 'Tutoria 2',
      turma: 'MD2',
    })

    const matriculas = await testPrisma.matricula.findMany({
      where: { usuario: { email } },
    })
    expect(matriculas).toHaveLength(2)
  })

  it('rollback: se uma matrícula falhar, módulo e problemas não persistem', async () => {
    const tutor = await seedTutor()

    // Cria um aluno fora da transação para simular um cenário extremo:
    // forçamos um conflito reusando email que já tem matrícula no mesmo módulo
    await expect(
      criarModulo({
        tutorId: tutor.id,
        emailsAlunos: ['x@aluno.cesupa.br', 'x@aluno.cesupa.br'],
        qtdProblemas: 3,
      })
    ).rejects.toThrow()

    // Nenhum módulo nem problema devem ter sido persistidos
    expect(await testPrisma.modulo.count()).toBe(0)
    expect(await testPrisma.problema.count()).toBe(0)
  })
})
