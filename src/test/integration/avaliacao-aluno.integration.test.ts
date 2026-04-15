/**
 * Integração: POST /api/avaliacoes/aluno
 * (lógica em src/app/api/avaliacoes/aluno/route.ts)
 *
 * Foco:
 *  - upsert de avaliações + criação de Submissao em transação atômica
 *  - constraint única de Submissao (problema+avaliador+tipoEncontro)
 *  - notificações criadas para tutor titular + co-tutores com permissão
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { TipoEncontro } from '@prisma/client'
import { testPrisma, truncateAll } from '../db'
import { ativarEncontro, seedAluno, seedModuloCompleto, seedTutor } from '../helpers'

beforeEach(async () => {
  await truncateAll()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

/**
 * Reproduz a transação de submissão do aluno do route.ts.
 */
async function submeterAvaliacaoAluno(params: {
  problemaId: string
  tipoEncontro: TipoEncontro
  avaliadorId: string
  avaliacoes: Array<{
    avaliadoId: string
    c1: number
    c2: number
    c3: number
    atitudes: number
  }>
}) {
  await testPrisma.$transaction(async (tx) => {
    for (const av of params.avaliacoes) {
      await tx.avaliacaoAluno.upsert({
        where: {
          problemaId_avaliadorId_avaliadoId_tipoEncontro: {
            problemaId: params.problemaId,
            avaliadorId: params.avaliadorId,
            avaliadoId: av.avaliadoId,
            tipoEncontro: params.tipoEncontro,
          },
        },
        update: { c1: av.c1, c2: av.c2, c3: av.c3, atitudes: av.atitudes },
        create: {
          problemaId: params.problemaId,
          avaliadorId: params.avaliadorId,
          avaliadoId: av.avaliadoId,
          tipoEncontro: params.tipoEncontro,
          c1: av.c1,
          c2: av.c2,
          c3: av.c3,
          atitudes: av.atitudes,
        },
      })
    }
    await tx.submissao.create({
      data: {
        problemaId: params.problemaId,
        avaliadorId: params.avaliadorId,
        tipoEncontro: params.tipoEncontro,
      },
    })
  })
}

/**
 * Reproduz a função `criarNotificacoes` do route.ts.
 */
async function criarNotificacoes(params: {
  problemaId: string
  tipoEncontro: TipoEncontro
  problemaNumero: number
  alunoNome: string
  moduloNome: string
  moduloTutoria: string
  moduloTutorId: string
}) {
  const tutorIds = new Set<string>([params.moduloTutorId])
  const perms = await testPrisma.coTutorPermissao.findMany({
    where: { problemaId: params.problemaId, tipoEncontro: params.tipoEncontro },
    include: { coTutor: { select: { tutorId: true } } },
  })
  for (const p of perms) tutorIds.add(p.coTutor.tutorId)

  await testPrisma.notificacao.createMany({
    data: Array.from(tutorIds).map((tutorId) => ({
      tutorId,
      titulo: `Nova avaliação — P${params.problemaNumero}`,
      mensagem: `${params.alunoNome} enviou avaliações.`,
      problemaId: params.problemaId,
      tipoEncontro: params.tipoEncontro,
    })),
  })
}

describe('Submissão de avaliação do aluno (integração)', () => {
  it('cria avaliações e a Submissao em uma transação atômica', async () => {
    const { problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 3 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')

    const [avaliador, ...colegas] = alunos

    await submeterAvaliacaoAluno({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      avaliadorId: avaliador.id,
      avaliacoes: colegas.map((c) => ({
        avaliadoId: c.id,
        c1: 4,
        c2: 4,
        c3: 4,
        atitudes: 0.2,
      })),
    })

    const avs = await testPrisma.avaliacaoAluno.findMany({
      where: { avaliadorId: avaliador.id },
    })
    const sub = await testPrisma.submissao.findUnique({
      where: {
        problemaId_avaliadorId_tipoEncontro: {
          problemaId: problemas[0].id,
          avaliadorId: avaliador.id,
          tipoEncontro: 'ABERTURA',
        },
      },
    })
    expect(avs).toHaveLength(2)
    expect(sub).not.toBeNull()
  })

  it('rejeita segunda submissão do mesmo aluno (constraint única na Submissao)', async () => {
    const { problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 2 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')
    const [avaliador, colega] = alunos

    const payload = {
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA' as const,
      avaliadorId: avaliador.id,
      avaliacoes: [{ avaliadoId: colega.id, c1: 4, c2: 4, c3: 4, atitudes: 0 }],
    }

    await submeterAvaliacaoAluno(payload)
    await expect(submeterAvaliacaoAluno(payload)).rejects.toThrow(/Unique constraint|P2002/i)
  })

  it('aceita auto-avaliação (avaliador = avaliado)', async () => {
    const { problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')
    const aluno = alunos[0]

    await submeterAvaliacaoAluno({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      avaliadorId: aluno.id,
      avaliacoes: [{ avaliadoId: aluno.id, c1: 5, c2: 5, c3: 5, atitudes: 0 }],
    })

    const auto = await testPrisma.avaliacaoAluno.findFirstOrThrow({
      where: { avaliadorId: aluno.id, avaliadoId: aluno.id },
    })
    expect(Number(auto.c1)).toBe(5)
  })

  it('cria 1 notificação para o tutor titular quando não há co-tutor', async () => {
    const { tutor, modulo, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')

    await submeterAvaliacaoAluno({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      avaliadorId: alunos[0].id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 4, c2: 4, c3: 4, atitudes: 0 }],
    })
    await criarNotificacoes({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      problemaNumero: problemas[0].numero,
      alunoNome: alunos[0].nome,
      moduloNome: modulo.nome,
      moduloTutoria: modulo.tutoria,
      moduloTutorId: tutor.id,
    })

    const notifs = await testPrisma.notificacao.findMany()
    expect(notifs).toHaveLength(1)
    expect(notifs[0].tutorId).toBe(tutor.id)
    expect(notifs[0].lida).toBe(false)
  })

  it('notifica também co-tutor com permissão para o problema+tipo', async () => {
    const { tutor, modulo, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')

    const cotutorUser = await seedTutor({ email: 'co@prof.cesupa.br' })
    const coTutor = await testPrisma.coTutor.create({
      data: { moduloId: modulo.id, tutorId: cotutorUser.id },
    })
    await testPrisma.coTutorPermissao.create({
      data: {
        coTutorId: coTutor.id,
        problemaId: problemas[0].id,
        tipoEncontro: 'ABERTURA',
      },
    })

    await submeterAvaliacaoAluno({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      avaliadorId: alunos[0].id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 4, c2: 4, c3: 4, atitudes: 0 }],
    })
    await criarNotificacoes({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      problemaNumero: problemas[0].numero,
      alunoNome: alunos[0].nome,
      moduloNome: modulo.nome,
      moduloTutoria: modulo.tutoria,
      moduloTutorId: tutor.id,
    })

    const notifs = await testPrisma.notificacao.findMany({ orderBy: { tutorId: 'asc' } })
    expect(notifs).toHaveLength(2)
    const ids = notifs.map((n) => n.tutorId).sort()
    expect(ids).toEqual([tutor.id, cotutorUser.id].sort())
  })

  it('NÃO notifica co-tutor cuja permissão é para outro tipoEncontro', async () => {
    const { tutor, modulo, problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 1 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')

    const cotutorUser = await seedTutor({ email: 'co2@prof.cesupa.br' })
    const coTutor = await testPrisma.coTutor.create({
      data: { moduloId: modulo.id, tutorId: cotutorUser.id },
    })
    // Permissão para FECHAMENTO — não deve receber notificação de ABERTURA
    await testPrisma.coTutorPermissao.create({
      data: {
        coTutorId: coTutor.id,
        problemaId: problemas[0].id,
        tipoEncontro: 'FECHAMENTO',
      },
    })

    await submeterAvaliacaoAluno({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      avaliadorId: alunos[0].id,
      avaliacoes: [{ avaliadoId: alunos[0].id, c1: 4, c2: 4, c3: 4, atitudes: 0 }],
    })
    await criarNotificacoes({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      problemaNumero: problemas[0].numero,
      alunoNome: alunos[0].nome,
      moduloNome: modulo.nome,
      moduloTutoria: modulo.tutoria,
      moduloTutorId: tutor.id,
    })

    const notifs = await testPrisma.notificacao.findMany()
    expect(notifs).toHaveLength(1) // só o tutor titular
    expect(notifs[0].tutorId).toBe(tutor.id)
  })

  it('rollback: se a Submissao falhar (duplicada), a avaliação anterior persiste e a nova rollback', async () => {
    const { problemas, alunos } = await seedModuloCompleto({ qtdAlunos: 2 })
    await ativarEncontro(problemas[0].id, 'ABERTURA')
    const [avaliador, colega] = alunos

    // 1ª submissão OK
    await submeterAvaliacaoAluno({
      problemaId: problemas[0].id,
      tipoEncontro: 'ABERTURA',
      avaliadorId: avaliador.id,
      avaliacoes: [{ avaliadoId: colega.id, c1: 3, c2: 3, c3: 3, atitudes: 0 }],
    })
    // 2ª tentativa: como a Submissao já existe, transação volta atrás
    // e qualquer alteração tentada na avaliação NÃO persiste.
    await expect(
      submeterAvaliacaoAluno({
        problemaId: problemas[0].id,
        tipoEncontro: 'ABERTURA',
        avaliadorId: avaliador.id,
        avaliacoes: [{ avaliadoId: colega.id, c1: 5, c2: 5, c3: 5, atitudes: 0 }],
      })
    ).rejects.toThrow()

    const av = await testPrisma.avaliacaoAluno.findFirstOrThrow({
      where: { avaliadorId: avaliador.id, avaliadoId: colega.id },
    })
    expect(Number(av.c1)).toBe(3) // valor original preservado
  })
})
