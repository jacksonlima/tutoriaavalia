/**
 * Integração: POST /api/avaliacoes/tutor
 * (lógica em src/app/api/avaliacoes/tutor/route.ts)
 *
 * Foco: upsert correto, constraint única (problema+avaliado+tipoEncontro)
 * e atualização preservando finalizado=false.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { TipoEncontro } from '@prisma/client'
import { testPrisma, truncateAll } from '../db'
import { seedModuloCompleto } from '../helpers'

beforeEach(async () => {
  await truncateAll()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

/**
 * Reproduz o `prisma.$transaction(avaliacoes.map(prisma.avaliacaoTutor.upsert(...)))`
 * do route.ts, sem auth/Zod.
 */
async function salvarAvaliacoesTutor(params: {
  problemaId: string
  tipoEncontro: TipoEncontro
  tutorId: string
  avaliacoes: Array<{
    avaliadoId: string
    c1: number
    c2: number
    c3: number
    atitudes: number
    ativCompensatoria?: boolean
    faltou?: boolean
  }>
}) {
  return testPrisma.$transaction(
    params.avaliacoes.map((av) =>
      testPrisma.avaliacaoTutor.upsert({
        where: {
          problemaId_avaliadoId_tipoEncontro: {
            problemaId: params.problemaId,
            avaliadoId: av.avaliadoId,
            tipoEncontro: params.tipoEncontro,
          },
        },
        update: {
          c1: av.c1,
          c2: av.c2,
          c3: av.c3,
          atitudes: av.atitudes,
          ativCompensatoria: av.ativCompensatoria ?? false,
          faltou: av.faltou ?? false,
        },
        create: {
          problemaId: params.problemaId,
          avaliadoId: av.avaliadoId,
          tutorId: params.tutorId,
          tipoEncontro: params.tipoEncontro,
          c1: av.c1,
          c2: av.c2,
          c3: av.c3,
          atitudes: av.atitudes,
          ativCompensatoria: av.ativCompensatoria ?? false,
          faltou: av.faltou ?? false,
          finalizado: false,
        },
      })
    )
  )
}

describe('Avaliação do tutor (integração)', () => {
  it('cria N avaliações em uma única chamada', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 3 })

    const saved = await salvarAvaliacoesTutor({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      tutorId: tutor.id,
      avaliacoes: alunos.map((a) => ({
        avaliadoId: a.id,
        c1: 4,
        c2: 4,
        c3: 4,
        atitudes: 0.2,
      })),
    })

    expect(saved).toHaveLength(3)
    const persistidas = await testPrisma.avaliacaoTutor.findMany({
      where: { problemaId: problemas[0].id, tipoEncontro: 'ABERTURA' },
    })
    expect(persistidas).toHaveLength(3)
    expect(persistidas[0].finalizado).toBe(false)
  })

  it('upsert: chamar de novo atualiza valores em vez de duplicar', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })

    // Salva primeiro com nota 3
    await salvarAvaliacoesTutor({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      tutorId: tutor.id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 3, c2: 3, c3: 3, atitudes: 0 }],
    })
    // Salva de novo com nota 5
    await salvarAvaliacoesTutor({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      tutorId: tutor.id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 5, c2: 5, c3: 5, atitudes: 0 }],
    })

    const todas = await testPrisma.avaliacaoTutor.findMany({
      where: { problemaId: problemas[0].id, tipoEncontro: 'ABERTURA', avaliadoId: alunos[0].id },
    })
    expect(todas).toHaveLength(1) // upsert, não criou duplicada
    // Prisma retorna Decimal — converter para Number antes de comparar
    expect(Number(todas[0].c1)).toBe(5) // valor atualizado
    expect(todas[0].finalizado).toBe(false) // continua editável
  })

  it('mesma combinação aluno+problema gera registros distintos por tipoEncontro', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })

    await salvarAvaliacoesTutor({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      tutorId: tutor.id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 4, c2: 4, c3: 4, atitudes: 0 }],
    })
    await salvarAvaliacoesTutor({
      problemaId: problemas[0].id,
      tipoEncontro: 'FECHAMENTO',
      tutorId: tutor.id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 5, c2: 5, c3: 5, atitudes: 0 }],
    })

    const todas = await testPrisma.avaliacaoTutor.findMany({
      where: { problemaId: problemas[0].id, avaliadoId: alunos[0].id },
    })
    expect(todas).toHaveLength(2) // ABERTURA + FECHAMENTO são registros separados
  })

  it('persiste flag de atividade compensatória e faltou', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })

    await salvarAvaliacoesTutor({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      tutorId: tutor.id,
      avaliacoes: [
        {
          avaliadoId: alunos[0].id,
          c1: 0,
          c2: 0,
          c3: 0,
          atitudes: 0,
          ativCompensatoria: true,
          faltou: true,
        },
      ],
    })

    const av = await testPrisma.avaliacaoTutor.findFirstOrThrow({
      where: { avaliadoId: alunos[0].id },
    })
    expect(av.ativCompensatoria).toBe(true)
    expect(av.faltou).toBe(true)
  })

  it('rollback: se uma avaliação falhar, nenhuma das outras persiste', async () => {
    const { tutor, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 2 })
    const idInexistente = '00000000-0000-4000-8000-000000000000'

    await expect(
      salvarAvaliacoesTutor({
        problemaId: problemas[0].id,
        tipoEncontro: 'ABERTURA',
        tutorId: tutor.id,
        avaliacoes: [
          { avaliadoId: alunos[0].id, c1: 4, c2: 4, c3: 4, atitudes: 0 },
          // Esse aluno não existe → fk falha → toda a transação volta atrás
          { avaliadoId: idInexistente, c1: 4, c2: 4, c3: 4, atitudes: 0 },
        ],
      })
    ).rejects.toThrow()

    const persistidas = await testPrisma.avaliacaoTutor.count()
    expect(persistidas).toBe(0)
  })
})
