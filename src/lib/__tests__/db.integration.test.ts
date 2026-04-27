/**
 * TutoriaAvalia v2 — Testes de Integração: Banco de Dados
 * Autor: Jackson Lima — CESUPA
 *
 * Testa as operações Prisma + PostgreSQL reais.
 * Requer banco de teste configurado no .env.test
 *
 * Para rodar localmente:
 *   DATABASE_URL="postgresql://test:test@localhost:5432/tutoriaavalia_test"
 *   npx prisma migrate deploy
 *   npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Setup e cleanup ────────────────────────────────────────────────
beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

beforeEach(async () => {
  await limpar()
})

async function limpar() {
  await prisma.notificacao.deleteMany()
  await prisma.submissao.deleteMany()
  await prisma.janelaComplementar.deleteMany()
  await prisma.avaliacaoAluno.deleteMany()
  await prisma.avaliacaoTutor.deleteMany()
  await prisma.situacaoExcepcional.deleteMany()
  await prisma.coTutorPermissao.deleteMany()
  await prisma.matricula.deleteMany()
  await prisma.problema.deleteMany()
  await prisma.modulo.deleteMany()
  await prisma.usuario.deleteMany()
}

// ── Helpers ────────────────────────────────────────────────────────
async function criarTutor(suffix = '1') {
  return prisma.usuario.create({
    data: {
      email:  `tutor${suffix}@prof.cesupa.br`,
      nome:   `Tutor Teste ${suffix}`,
      papel:  'TUTOR',
    },
  })
}

async function criarAluno(suffix = '1') {
  return prisma.usuario.create({
    data: {
      email:  `aluno${suffix}@aluno.cesupa.br`,
      nome:   `Aluno Teste ${suffix}`,
      papel:  'ALUNO',
    },
  })
}

async function criarModulo(tutorId: string) {
  return prisma.modulo.create({
    data: {
      nome:     'I - Introdução ao Estudo da Medicina',
      ano:       2026,
      semestre: '01',
      tutoria:  'Tutoria 5',
      turma:    'MD1',
      tutorId,
    },
  })
}

// ── Testes ─────────────────────────────────────────────────────────
describe('Usuário', () => {
  it('cria tutor e recupera do banco', async () => {
    const tutor = await criarTutor()
    const encontrado = await prisma.usuario.findUnique({ where: { id: tutor.id } })
    expect(encontrado).not.toBeNull()
    expect(encontrado?.papel).toBe('TUTOR')
    expect(encontrado?.email).toBe('tutor1@prof.cesupa.br')
  })

  it('e-mail deve ser único', async () => {
    await criarTutor()
    await expect(criarTutor()).rejects.toThrow()
  })

  it('cria aluno com papel ALUNO', async () => {
    const aluno = await criarAluno()
    expect(aluno.papel).toBe('ALUNO')
  })
})

describe('Módulo', () => {
  it('cria módulo vinculado a um tutor', async () => {
    const tutor  = await criarTutor()
    const modulo = await criarModulo(tutor.id)
    expect(modulo.tutorId).toBe(tutor.id)
    expect(modulo.ativo).toBe(true)
    expect(modulo.arquivado).toBe(false)
  })

  it('cria problema dentro de um módulo', async () => {
    const tutor  = await criarTutor()
    const modulo = await criarModulo(tutor.id)
    const prob   = await prisma.problema.create({
      data: {
        moduloId: modulo.id,
        numero:   1,
        nome:     'Problema 01',
        temSaltoTriplo: false,
      },
    })
    expect(prob.moduloId).toBe(modulo.id)
    expect(prob.temSaltoTriplo).toBe(false)
  })

  it('matricula aluno em módulo', async () => {
    const tutor  = await criarTutor()
    const aluno  = await criarAluno()
    const modulo = await criarModulo(tutor.id)

    const matricula = await prisma.matricula.create({
      data: {
        moduloId:     modulo.id,
        usuarioId:    aluno.id,
        numeraNaTurma: 1,
      },
    })
    expect(matricula.moduloId).toBe(modulo.id)
    expect(matricula.usuarioId).toBe(aluno.id)
  })
})

describe('Avaliação do Tutor', () => {
  it('registra avaliação e recupera corretamente', async () => {
    const tutor  = await criarTutor()
    const aluno  = await criarAluno()
    const modulo = await criarModulo(tutor.id)
    const prob   = await prisma.problema.create({
      data: { moduloId: modulo.id, numero: 1, nome: 'P01' },
    })

    const av = await prisma.avaliacaoTutor.create({
      data: {
        problemaId:  prob.id,
        avaliadoId:  aluno.id,
        tutorId:     tutor.id,
        tipoEncontro: 'ABERTURA',
        c1: 4, c2: 4, c3: 4,
        atitudes: 1,
        ativCompensatoria: false,
        faltou: false,
      },
    })

    expect(Number(av.c1)).toBe(4)
    expect(av.faltou).toBe(false)
    expect(av.tipoEncontro).toBe('ABERTURA')
  })

  it('upsert não duplica avaliação do mesmo aluno no mesmo encontro', async () => {
    const tutor  = await criarTutor()
    const aluno  = await criarAluno()
    const modulo = await criarModulo(tutor.id)
    const prob   = await prisma.problema.create({
      data: { moduloId: modulo.id, numero: 1, nome: 'P01' },
    })

    const base = { problemaId: prob.id, avaliadoId: aluno.id, tipoEncontro: 'ABERTURA' as const }

    await prisma.avaliacaoTutor.upsert({
      where: { problemaId_avaliadoId_tipoEncontro: base },
      create: { ...base, tutorId: tutor.id, c1: 3, c2: 3, c3: 3, atitudes: 0.8, ativCompensatoria: false, faltou: false },
      update: { c1: 5, c2: 5, c3: 5 },
    })

    await prisma.avaliacaoTutor.upsert({
      where: { problemaId_avaliadoId_tipoEncontro: base },
      create: { ...base, tutorId: tutor.id, c1: 3, c2: 3, c3: 3, atitudes: 0.8, ativCompensatoria: false, faltou: false },
      update: { c1: 5, c2: 5, c3: 5 },
    })

    const total = await prisma.avaliacaoTutor.count({ where: base })
    expect(total).toBe(1)
  })
})

describe('Notificação', () => {
  it('cria e marca notificação como lida', async () => {
    const tutor = await criarTutor()

    const notif = await prisma.notificacao.create({
      data: {
        tutorId:  tutor.id,
        titulo:   'Nova submissão',
        mensagem: 'Um aluno enviou sua avaliação',
        lida:     false,
      },
    })

    expect(notif.lida).toBe(false)

    await prisma.notificacao.update({
      where: { id: notif.id },
      data:  { lida: true },
    })

    const atualizada = await prisma.notificacao.findUnique({ where: { id: notif.id } })
    expect(atualizada?.lida).toBe(true)
  })
})
