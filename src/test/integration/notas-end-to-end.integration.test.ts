/**
 * Integração end-to-end: fluxo completo de avaliação até nota formativa.
 *
 * Cria módulo → ativa encontro → tutor avalia → alunos auto+peer avaliam
 *  → busca dados como faria a /api/notas → calcula nota formativa
 *
 * Garante que a integração entre `notas.ts` (fórmulas) e o schema do
 * banco produz números corretos.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { testPrisma, truncateAll } from '../db'
import { ativarEncontro, seedModuloCompleto } from '../helpers'
import {
  arredondar,
  calcMediaAberturas,
  calcMediaFechamentos,
  calcNotaEncontro,
  calcNotaFormativa,
} from '@/lib/notas'

beforeEach(async () => {
  await truncateAll()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

/**
 * Para um aluno num problema+tipoEncontro, devolve as três entradas
 * necessárias para `calcNotaEncontro`:
 *   - notaTutor:        média (c1,c2,c3)−atitudes vinda do tutor
 *   - mediaInterpares:  média das (c1,c2,c3)−atitudes dos colegas
 *   - notaAutoAvaliacao: média da auto-avaliação (se enviada)
 */
async function calcularComponentesEncontro(
  problemaId: string,
  alunoId: string,
  tipoEncontro: 'ABERTURA' | 'FECHAMENTO' | 'FECHAMENTO_A' | 'FECHAMENTO_B'
) {
  const tutorEval = await testPrisma.avaliacaoTutor.findUnique({
    where: {
      problemaId_avaliadoId_tipoEncontro: {
        problemaId,
        avaliadoId: alunoId,
        tipoEncontro,
      },
    },
  })
  // Prisma retorna Decimal — converter para Number antes de qualquer aritmética.
  const notaTutor = !tutorEval
    ? null
    : tutorEval.ativCompensatoria
      ? ('SATISFATORIO' as const)
      : (Number(tutorEval.c1) + Number(tutorEval.c2) + Number(tutorEval.c3)) / 3 -
        Number(tutorEval.atitudes)

  const peerEvals = await testPrisma.avaliacaoAluno.findMany({
    where: {
      problemaId,
      avaliadoId: alunoId,
      tipoEncontro,
      avaliadorId: { not: alunoId },
    },
  })
  const mediaInterpares =
    peerEvals.length === 0
      ? null
      : peerEvals.reduce(
          (acc, e) =>
            acc +
            ((Number(e.c1) + Number(e.c2) + Number(e.c3)) / 3 - Number(e.atitudes)),
          0
        ) / peerEvals.length

  const autoEval = await testPrisma.avaliacaoAluno.findUnique({
    where: {
      problemaId_avaliadorId_avaliadoId_tipoEncontro: {
        problemaId,
        avaliadorId: alunoId,
        avaliadoId: alunoId,
        tipoEncontro,
      },
    },
  })
  const notaAutoAvaliacao = !autoEval
    ? null
    : (Number(autoEval.c1) + Number(autoEval.c2) + Number(autoEval.c3)) / 3 -
      Number(autoEval.atitudes)

  return { notaTutor, mediaInterpares, notaAutoAvaliacao }
}

describe('Fluxo completo: avaliações → nota formativa', () => {
  it('aluno regular com 1 problema (abertura+fechamento) tem nota positiva', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({
      qtdAlunos: 3,
      qtdProblemas: 1,
    })
    const [aluno, colega1, colega2] = alunos
    const problema = problemas[0]
    await ativarEncontro(problema.id, 'ABERTURA')
    await ativarEncontro(problema.id, 'FECHAMENTO')

    // ── Tutor avalia o aluno em ABERTURA ──
    await testPrisma.avaliacaoTutor.create({
      data: {
        problemaId: problema.id,
        avaliadoId: aluno.id,
        tutorId: tutor.id,
        tipoEncontro: 'ABERTURA',
        c1: 5, c2: 5, c3: 5, atitudes: 0,
      },
    })
    // ── Tutor avalia em FECHAMENTO ──
    await testPrisma.avaliacaoTutor.create({
      data: {
        problemaId: problema.id,
        avaliadoId: aluno.id,
        tutorId: tutor.id,
        tipoEncontro: 'FECHAMENTO',
        c1: 4, c2: 4, c3: 4, atitudes: 0,
      },
    })
    // ── Colegas avaliam em ABERTURA ──
    for (const c of [colega1, colega2]) {
      await testPrisma.avaliacaoAluno.create({
        data: {
          problemaId: problema.id,
          avaliadorId: c.id,
          avaliadoId: aluno.id,
          tipoEncontro: 'ABERTURA',
          c1: 4, c2: 4, c3: 4, atitudes: 0,
        },
      })
    }
    // ── Aluno faz auto-avaliação em ABERTURA ──
    await testPrisma.avaliacaoAluno.create({
      data: {
        problemaId: problema.id,
        avaliadorId: aluno.id,
        avaliadoId: aluno.id,
        tipoEncontro: 'ABERTURA',
        c1: 4, c2: 4, c3: 4, atitudes: 0,
      },
    })

    // Nota da abertura: notaTutor=5, inter=4, auto=4
    // (4×0,5 + 4×0,5 + 5×4) / 5 = (2 + 2 + 20) / 5 = 4,8
    const compsAbertura = await calcularComponentesEncontro(
      problema.id,
      aluno.id,
      'ABERTURA'
    )
    const notaAbertura = calcNotaEncontro(compsAbertura)
    expect(notaAbertura).toBeCloseTo(4.8, 5)

    // Nota do fechamento: tutor=4, sem peers, sem auto
    // (0×0,5 + 4×4) / 4,5 = 16/4,5 ≈ 3,5555...
    const compsFechamento = await calcularComponentesEncontro(
      problema.id,
      aluno.id,
      'FECHAMENTO'
    )
    const notaFechamento = calcNotaEncontro(compsFechamento)
    expect(notaFechamento).toBeCloseTo(16 / 4.5, 5)

    // Nota formativa = média aberturas + média fechamentos (cap 10)
    const formativa = calcNotaFormativa(
      calcMediaAberturas([notaAbertura]),
      calcMediaFechamentos([notaFechamento])
    )
    expect(arredondar(formativa)).toBeGreaterThan(0)
    expect(arredondar(formativa)).toBeLessThanOrEqual(10)
  })

  it('aluno com atividade compensatória: nota SATISFATORIO é excluída da média', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({
      qtdAlunos: 1,
      qtdProblemas: 2,
    })
    const aluno = alunos[0]
    await ativarEncontro(problemas[0].id, 'ABERTURA')
    await ativarEncontro(problemas[1].id, 'ABERTURA')

    // Problema 1: nota normal
    await testPrisma.avaliacaoTutor.create({
      data: {
        problemaId: problemas[0].id,
        avaliadoId: aluno.id,
        tutorId: tutor.id,
        tipoEncontro: 'ABERTURA',
        c1: 5, c2: 5, c3: 5, atitudes: 0,
      },
    })
    // Problema 2: compensatória
    await testPrisma.avaliacaoTutor.create({
      data: {
        problemaId: problemas[1].id,
        avaliadoId: aluno.id,
        tutorId: tutor.id,
        tipoEncontro: 'ABERTURA',
        c1: 0, c2: 0, c3: 0, atitudes: 0,
        ativCompensatoria: true,
      },
    })

    const nota1 = calcNotaEncontro(
      await calcularComponentesEncontro(problemas[0].id, aluno.id, 'ABERTURA')
    )
    const nota2 = calcNotaEncontro(
      await calcularComponentesEncontro(problemas[1].id, aluno.id, 'ABERTURA')
    )

    expect(nota2).toBe('SATISFATORIO')

    const media = calcMediaAberturas([nota1, nota2])
    // Só nota1 entra na média; SATISFATORIO é excluído
    expect(media).toBe(nota1)
  })

  it('aluno faltoso (sem auto-avaliação): nota usa divisor 4,5', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({
      qtdAlunos: 3,
      qtdProblemas: 1,
    })
    const [aluno, c1, c2] = alunos
    const problema = problemas[0]
    await ativarEncontro(problema.id, 'ABERTURA')

    await testPrisma.avaliacaoTutor.create({
      data: {
        problemaId: problema.id,
        avaliadoId: aluno.id,
        tutorId: tutor.id,
        tipoEncontro: 'ABERTURA',
        c1: 5, c2: 5, c3: 5, atitudes: 0,
        faltou: true,
      },
    })
    for (const colega of [c1, c2]) {
      await testPrisma.avaliacaoAluno.create({
        data: {
          problemaId: problema.id,
          avaliadorId: colega.id,
          avaliadoId: aluno.id,
          tipoEncontro: 'ABERTURA',
          c1: 4, c2: 4, c3: 4, atitudes: 0,
        },
      })
    }
    // Sem auto-avaliação (aluno faltou)

    const comps = await calcularComponentesEncontro(problema.id, aluno.id, 'ABERTURA')
    expect(comps.notaAutoAvaliacao).toBeNull() // confirma que auto = null
    const nota = calcNotaEncontro(comps)
    // (4×0,5 + 5×4) / 4,5 = 22/4,5 ≈ 4,888...
    expect(nota).toBeCloseTo(22 / 4.5, 5)
  })
})
