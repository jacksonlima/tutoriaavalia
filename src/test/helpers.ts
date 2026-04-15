/**
 * Helpers de seed para testes de integração.
 *
 * Cada helper cria uma entidade mínima viável e devolve o registro.
 * Compor estes helpers em cada teste mantém a setup curta e legível.
 */
import { Papel, TipoEncontro } from '@prisma/client'
import { testPrisma } from './db'

let counter = 0
const next = () => ++counter

export async function seedTutor(overrides: Partial<{ email: string; nome: string }> = {}) {
  const n = next()
  return testPrisma.usuario.create({
    data: {
      email: overrides.email ?? `tutor${n}@prof.cesupa.br`,
      nome: overrides.nome ?? `Tutor ${n}`,
      papel: Papel.TUTOR,
    },
  })
}

export async function seedAluno(overrides: Partial<{ email: string; nome: string }> = {}) {
  const n = next()
  return testPrisma.usuario.create({
    data: {
      email: overrides.email ?? `aluno${n}@aluno.cesupa.br`,
      nome: overrides.nome ?? `Aluno ${n}`,
      papel: Papel.ALUNO,
    },
  })
}

/**
 * Cria um módulo completo: tutor + N alunos matriculados + N problemas.
 * Por padrão: 1 problema, 3 alunos. Todos os encontros desativados.
 */
export async function seedModuloCompleto(opts: {
  tutorId?: string
  qtdProblemas?: number
  qtdAlunos?: number
  ativo?: boolean
} = {}) {
  const qtdProblemas = opts.qtdProblemas ?? 1
  const qtdAlunos = opts.qtdAlunos ?? 3

  const tutor = opts.tutorId
    ? await testPrisma.usuario.findUniqueOrThrow({ where: { id: opts.tutorId } })
    : await seedTutor()

  const n = next()
  const modulo = await testPrisma.modulo.create({
    data: {
      nome: 'III - Ataque e Defesa',
      ano: 2026,
      semestre: '01',
      tutoria: 'Tutoria 1',
      turma: `MD${(n % 8) + 1}`,
      tutorId: tutor.id,
      ativo: opts.ativo ?? true,
    },
  })

  const problemas = []
  for (let i = 1; i <= qtdProblemas; i++) {
    problemas.push(
      await testPrisma.problema.create({
        data: {
          moduloId: modulo.id,
          numero: i,
          nome: `Problema ${i}`,
        },
      })
    )
  }

  const alunos = []
  for (let i = 0; i < qtdAlunos; i++) {
    const aluno = await seedAluno()
    await testPrisma.matricula.create({
      data: { moduloId: modulo.id, usuarioId: aluno.id, numeraNaTurma: i + 1 },
    })
    alunos.push(aluno)
  }

  return { tutor, modulo, problemas, alunos }
}

/**
 * Ativa um tipo de encontro num problema (espelha o que o tutor faz na UI).
 */
export async function ativarEncontro(
  problemaId: string,
  tipo: TipoEncontro
): Promise<void> {
  const campo: Record<TipoEncontro, string> = {
    ABERTURA: 'aberturaAtiva',
    FECHAMENTO: 'fechamentoAtivo',
    FECHAMENTO_A: 'fechamentoAAtivo',
    FECHAMENTO_B: 'fechamentoBAtivo',
  }
  await testPrisma.problema.update({
    where: { id: problemaId },
    data: { [campo[tipo]]: true },
  })
}
