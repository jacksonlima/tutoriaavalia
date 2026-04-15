/**
 * globalSetup do Playwright.
 *
 * Roda DEPOIS que o wrapper (e2e/run.ts) já subiu o Postgres embutido e
 * aplicou o schema via `prisma db push`. Aqui apenas populamos o banco
 * com os usuários e módulo mínimos que os specs esperam encontrar.
 *
 * Não derrubamos nada aqui — o cleanup é do wrapper.
 */
import { PrismaClient, Papel } from '@prisma/client'

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[e2e] DATABASE_URL não setado — rode a suíte via `npm run test:e2e` (wrapper cuida do Postgres)'
    )
  }

  const prisma = new PrismaClient()
  try {
    // Tutor titular do módulo de teste
    const tutor = await prisma.usuario.create({
      data: {
        email: 'tutor.e2e@prof.cesupa.br',
        nome: 'Tutora E2E',
        papel: Papel.TUTOR,
      },
    })

    // 2 alunos — suficiente para formulário de avaliação interpares
    const aluno1 = await prisma.usuario.create({
      data: {
        email: 'aluno1.e2e@aluno.cesupa.br',
        nome: 'Aluno E2E Um',
        papel: Papel.ALUNO,
      },
    })
    const aluno2 = await prisma.usuario.create({
      data: {
        email: 'aluno2.e2e@aluno.cesupa.br',
        nome: 'Aluno E2E Dois',
        papel: Papel.ALUNO,
      },
    })

    // Módulo ativo + 1 problema + matrículas — garante que o dashboard
    // do aluno mostre algo e que o dashboard do tutor liste o módulo.
    const modulo = await prisma.modulo.create({
      data: {
        nome: 'III - Ataque e Defesa',
        ano: 2026,
        semestre: '01',
        tutoria: 'Tutoria 1',
        turma: 'MD1',
        tutorId: tutor.id,
        ativo: true,
      },
    })

    await prisma.problema.create({
      data: { moduloId: modulo.id, numero: 1, nome: 'Problema 1' },
    })

    await prisma.matricula.create({
      data: { moduloId: modulo.id, usuarioId: aluno1.id, numeraNaTurma: 1 },
    })
    await prisma.matricula.create({
      data: { moduloId: modulo.id, usuarioId: aluno2.id, numeraNaTurma: 2 },
    })

    console.log('[e2e] seed concluído: 1 tutor, 2 alunos, 1 módulo ativo com 1 problema')
  } finally {
    await prisma.$disconnect()
  }
}
