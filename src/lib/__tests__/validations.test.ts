/**
 * Testes para src/lib/validations.ts
 *
 * Schemas Zod são a primeira linha de defesa das Server Actions contra
 * dados maliciosos ou mal formados. Estes testes cobrem valores válidos,
 * limites e principais casos de rejeição.
 */
import { describe, it, expect } from 'vitest'
import {
  criarModuloSchema,
  editarModuloSchema,
  avaliacaoTutorSchema,
  avaliacaoAlunoSchema,
  ativarEncontroSchema,
  OPCOES_TUTORIA,
  OPCOES_TURMA,
  OPCOES_SEMESTRE,
  OPCOES_MODULO,
} from '../validations'

// UUIDs de exemplo (formato válido) para compor payloads de teste
const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const UUID_C = '33333333-3333-4333-8333-333333333333'

// ────────────────────────────────────────────────────────────────
// Constantes de opções (regressão contra mudanças acidentais)
// ────────────────────────────────────────────────────────────────
describe('Opções fixas (listas oficiais CESUPA)', () => {
  it('OPCOES_TURMA contém as 8 turmas MD1..MD8', () => {
    expect(OPCOES_TURMA).toHaveLength(8)
    expect(OPCOES_TURMA).toContain('MD1')
    expect(OPCOES_TURMA).toContain('MD8')
  })

  it('OPCOES_SEMESTRE contém apenas "01" e "02"', () => {
    expect([...OPCOES_SEMESTRE]).toEqual(['01', '02'])
  })

  it('OPCOES_TUTORIA contém as 8 tutorias base + 3 extras', () => {
    expect(OPCOES_TUTORIA).toHaveLength(11)
    expect(OPCOES_TUTORIA).toContain('Tutoria 1')
    expect(OPCOES_TUTORIA).toContain('Tutoria Extra 3')
  })

  it('OPCOES_MODULO contém os 24 módulos oficiais da grade', () => {
    expect(OPCOES_MODULO).toHaveLength(24)
    expect(OPCOES_MODULO[0]).toMatch(/^I - /)
    expect(OPCOES_MODULO[23]).toMatch(/^XXIV - /)
  })
})

// ────────────────────────────────────────────────────────────────
// criarModuloSchema
// ────────────────────────────────────────────────────────────────
describe('criarModuloSchema', () => {
  const payloadValido = {
    nome: OPCOES_MODULO[0],
    ano: 2026,
    semestre: '01' as const,
    tutoria: 'Tutoria 1' as const,
    turma: 'MD1' as const,
    emailsAlunos: ['aluno1@aluno.cesupa.br', 'aluno2@aluno.cesupa.br'],
    quantidadeProblemas: 3,
    nomesProblemas: ['Problema 1', 'Problema 2', 'Problema 3'],
    temSaltoTriplo: false,
  }

  it('aceita payload mínimo válido', () => {
    const r = criarModuloSchema.safeParse(payloadValido)
    expect(r.success).toBe(true)
  })

  it('aplica default false em temSaltoTriplo quando omitido', () => {
    const { temSaltoTriplo, ...semSalto } = payloadValido
    const r = criarModuloSchema.safeParse(semSalto)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.temSaltoTriplo).toBe(false)
  })

  it('aceita salto triplo com problemasSaltoTriplo preenchido', () => {
    const r = criarModuloSchema.safeParse({
      ...payloadValido,
      temSaltoTriplo: true,
      quantidadeSaltos: 2,
      problemasSaltoTriplo: [1, 3],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita nome de módulo fora da lista oficial', () => {
    const r = criarModuloSchema.safeParse({
      ...payloadValido,
      nome: 'Módulo Inventado',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita ano < 2020', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, ano: 2019 })
    expect(r.success).toBe(false)
  })

  it('rejeita ano > 2100', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, ano: 2101 })
    expect(r.success).toBe(false)
  })

  it('rejeita ano não-inteiro', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, ano: 2025.5 })
    expect(r.success).toBe(false)
  })

  it('rejeita semestre diferente de "01" / "02"', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, semestre: '03' })
    expect(r.success).toBe(false)
  })

  it('rejeita tutoria fora da lista', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, tutoria: 'Tutoria 99' })
    expect(r.success).toBe(false)
  })

  it('rejeita turma fora da lista', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, turma: 'MD9' })
    expect(r.success).toBe(false)
  })

  it('rejeita email inválido na lista de alunos', () => {
    const r = criarModuloSchema.safeParse({
      ...payloadValido,
      emailsAlunos: ['nao-eh-email'],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita lista vazia de alunos', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, emailsAlunos: [] })
    expect(r.success).toBe(false)
  })

  it('rejeita mais de 11 alunos (tamanho máximo do grupo PBL)', () => {
    const emails = Array.from({ length: 12 }, (_, i) => `aluno${i}@aluno.cesupa.br`)
    const r = criarModuloSchema.safeParse({ ...payloadValido, emailsAlunos: emails })
    expect(r.success).toBe(false)
  })

  it('aceita exatamente 11 alunos (limite superior)', () => {
    const emails = Array.from({ length: 11 }, (_, i) => `aluno${i}@aluno.cesupa.br`)
    const r = criarModuloSchema.safeParse({ ...payloadValido, emailsAlunos: emails })
    expect(r.success).toBe(true)
  })

  it('rejeita quantidadeProblemas = 0', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, quantidadeProblemas: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita quantidadeProblemas > 20', () => {
    const r = criarModuloSchema.safeParse({ ...payloadValido, quantidadeProblemas: 21 })
    expect(r.success).toBe(false)
  })

  it('rejeita nome de problema com mais de 120 caracteres', () => {
    const r = criarModuloSchema.safeParse({
      ...payloadValido,
      nomesProblemas: ['a'.repeat(121)],
    })
    expect(r.success).toBe(false)
  })

  it('aceita nome de problema com exatamente 120 caracteres', () => {
    const r = criarModuloSchema.safeParse({
      ...payloadValido,
      nomesProblemas: ['a'.repeat(120)],
    })
    expect(r.success).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────
// editarModuloSchema
// ────────────────────────────────────────────────────────────────
describe('editarModuloSchema', () => {
  const payloadValido = {
    nome: OPCOES_MODULO[0],
    ano: 2026,
    semestre: '01' as const,
    tutoria: 'Tutoria 1' as const,
    turma: 'MD1' as const,
    emailsAlunos: ['aluno1@aluno.cesupa.br'],
    nomesProblemas: ['Problema 1'],
  }

  it('aceita payload completo', () => {
    expect(editarModuloSchema.safeParse(payloadValido).success).toBe(true)
  })

  it('permite omitir semestre (único campo opcional)', () => {
    const { semestre, ...sem } = payloadValido
    expect(editarModuloSchema.safeParse(sem).success).toBe(true)
  })

  it('rejeita ano fora do intervalo', () => {
    expect(editarModuloSchema.safeParse({ ...payloadValido, ano: 1999 }).success).toBe(false)
  })

  it('rejeita lista de alunos vazia', () => {
    expect(
      editarModuloSchema.safeParse({ ...payloadValido, emailsAlunos: [] }).success
    ).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────
// avaliacaoTutorSchema
// ────────────────────────────────────────────────────────────────
describe('avaliacaoTutorSchema', () => {
  const avaliacaoOk = {
    avaliadoId: UUID_A,
    c1: 4,
    c2: 4,
    c3: 4,
    atitudes: 0.2,
    ativCompensatoria: false,
    faltou: false,
  }

  it('aceita payload com 1 avaliação válida', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [avaliacaoOk],
    })
    expect(r.success).toBe(true)
  })

  it('aceita os 4 tipos de encontro (ABERTURA, FECHAMENTO, FECHAMENTO_A, FECHAMENTO_B)', () => {
    for (const tipo of ['ABERTURA', 'FECHAMENTO', 'FECHAMENTO_A', 'FECHAMENTO_B'] as const) {
      const r = avaliacaoTutorSchema.safeParse({
        problemaId: UUID_B,
        tipoEncontro: tipo,
        avaliacoes: [avaliacaoOk],
      })
      expect(r.success).toBe(true)
    }
  })

  it('rejeita tipo de encontro inexistente', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'INTERMEDIARIO',
      avaliacoes: [avaliacaoOk],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita problemaId não-UUID', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: 'nao-eh-uuid',
      tipoEncontro: 'ABERTURA',
      avaliacoes: [avaliacaoOk],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita array vazio de avaliações', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita mais de 11 avaliações', () => {
    const avaliacoes = Array.from({ length: 12 }, () => avaliacaoOk)
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes,
    })
    expect(r.success).toBe(false)
  })

  it('rejeita nota de critério < 0', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, c1: -1 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita nota de critério > 5', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, c2: 5.5 }],
    })
    expect(r.success).toBe(false)
  })

  it('aceita nota fracionada 4.5 (presente no dropdown)', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, c1: 4.5 }],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita atitudes > 1', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, atitudes: 1.1 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita atitudes < 0', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, atitudes: -0.1 }],
    })
    expect(r.success).toBe(false)
  })

  it('aplica defaults em ativCompensatoria e faltou quando omitidos', () => {
    const { ativCompensatoria, faltou, ...minimo } = avaliacaoOk
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [minimo],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.avaliacoes[0].ativCompensatoria).toBe(false)
      expect(r.data.avaliacoes[0].faltou).toBe(false)
    }
  })

  it('rejeita notas como string ("4" em vez de 4)', () => {
    const r = avaliacaoTutorSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, c1: '4' }],
    })
    expect(r.success).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────
// avaliacaoAlunoSchema
// ────────────────────────────────────────────────────────────────
describe('avaliacaoAlunoSchema', () => {
  const avaliacaoOk = {
    avaliadoId: UUID_A,
    c1: 4,
    c2: 4,
    c3: 4,
    atitudes: 0.2,
  }

  it('aceita payload válido', () => {
    const r = avaliacaoAlunoSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [avaliacaoOk],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita campo extra ativCompensatoria (aluno não controla isso)', () => {
    // Zod por padrão permite campos extras; este teste documenta o comportamento
    // atual: o schema de aluno não tem ativCompensatoria e Zod ignora extras.
    const r = avaliacaoAlunoSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, ativCompensatoria: true }],
    })
    expect(r.success).toBe(true) // Zod strip por padrão — campo extra é descartado
    if (r.success) {
      expect(r.data.avaliacoes[0]).not.toHaveProperty('ativCompensatoria')
    }
  })

  it('rejeita avaliadoId não-UUID', () => {
    const r = avaliacaoAlunoSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes: [{ ...avaliacaoOk, avaliadoId: 'abc' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita mais de 11 avaliações', () => {
    const avaliacoes = Array.from({ length: 12 }, (_, i) => ({
      ...avaliacaoOk,
      avaliadoId: UUID_A,
    }))
    const r = avaliacaoAlunoSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'ABERTURA',
      avaliacoes,
    })
    expect(r.success).toBe(false)
  })

  it('aceita avaliação com múltiplos colegas', () => {
    const r = avaliacaoAlunoSchema.safeParse({
      problemaId: UUID_B,
      tipoEncontro: 'FECHAMENTO',
      avaliacoes: [
        { ...avaliacaoOk, avaliadoId: UUID_A },
        { ...avaliacaoOk, avaliadoId: UUID_C },
      ],
    })
    expect(r.success).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────
// ativarEncontroSchema
// ────────────────────────────────────────────────────────────────
describe('ativarEncontroSchema', () => {
  it('aceita payload válido', () => {
    const r = ativarEncontroSchema.safeParse({
      problemaId: UUID_A,
      tipoEncontro: 'ABERTURA',
      ativo: true,
    })
    expect(r.success).toBe(true)
  })

  it('aceita desativação (ativo=false)', () => {
    const r = ativarEncontroSchema.safeParse({
      problemaId: UUID_A,
      tipoEncontro: 'FECHAMENTO',
      ativo: false,
    })
    expect(r.success).toBe(true)
  })

  it('rejeita problemaId não-UUID', () => {
    const r = ativarEncontroSchema.safeParse({
      problemaId: 'xyz',
      tipoEncontro: 'ABERTURA',
      ativo: true,
    })
    expect(r.success).toBe(false)
  })

  it('rejeita ativo como string', () => {
    const r = ativarEncontroSchema.safeParse({
      problemaId: UUID_A,
      tipoEncontro: 'ABERTURA',
      ativo: 'true',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita tipoEncontro desconhecido', () => {
    const r = ativarEncontroSchema.safeParse({
      problemaId: UUID_A,
      tipoEncontro: 'QUALQUER',
      ativo: true,
    })
    expect(r.success).toBe(false)
  })
})
