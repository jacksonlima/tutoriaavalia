/**
 * TutoriaAvalia v2 — Testes Unitários: Cálculo de Notas
 * Autor: Jackson Lima — CESUPA
 *
 * Testa as funções de notas.ts que implementam as fórmulas da planilha.
 * Nenhuma dependência externa — só JavaScript puro.
 *
 * Para rodar: npm run test:run
 */
import { describe, it, expect } from 'vitest'
import {
  calcMedia,
  calcMMenosAtTutor,
  calcMMenosAtAluno,
  calcNotaEncontro,
  calcMediaAberturas,
  calcMediaFechamentos,
  calcNotaFormativa,
  arredondar,
  fmt2,
} from '../notas'

// ── calcMedia ──────────────────────────────────────────────────────
describe('calcMedia', () => {
  it('média de três valores iguais', () => {
    expect(calcMedia(4, 4, 4)).toBe(4)
  })

  it('média de três valores diferentes', () => {
    expect(calcMedia(3, 4, 5)).toBeCloseTo(4)
  })

  it('média com zero', () => {
    expect(calcMedia(0, 0, 0)).toBe(0)
  })

  it('média máxima', () => {
    expect(calcMedia(5, 5, 5)).toBe(5)
  })
})

// ── calcMMenosAtTutor ──────────────────────────────────────────────
describe('calcMMenosAtTutor', () => {
  it('retorna SATISFATORIO quando atividade compensatória = true', () => {
    expect(calcMMenosAtTutor(5, 5, 5, 1, true)).toBe('SATISFATORIO')
  })

  it('retorna M - atitudes quando sem compensatória', () => {
    // média(4,4,4) = 4, atitudes = 1 → 4 - 1 = 3
    expect(calcMMenosAtTutor(4, 4, 4, 1, false)).toBeCloseTo(3)
  })

  it('pode ser negativo (atitudes maior que média)', () => {
    // média(1,1,1) = 1, atitudes = 1 → 0
    expect(calcMMenosAtTutor(1, 1, 1, 1, false)).toBeCloseTo(0)
  })
})

// ── calcMMenosAtAluno ──────────────────────────────────────────────
describe('calcMMenosAtAluno', () => {
  it('calcula M - atitudes para o aluno', () => {
    expect(calcMMenosAtAluno(4, 4, 4, 0.8)).toBeCloseTo(3.2)
  })

  it('notas máximas menos atitudes máximas', () => {
    expect(calcMMenosAtAluno(5, 5, 5, 1)).toBeCloseTo(4)
  })
})

// ── calcNotaEncontro ────────────────────────────────────────────────
describe('calcNotaEncontro — fórmula principal', () => {

  it('retorna null quando professor não lançou nota', () => {
    expect(calcNotaEncontro({
      notaTutor: null,
      mediaInterpares: 3,
      notaAutoAvaliacao: 4,
    })).toBeNull()
  })

  it('retorna SATISFATORIO quando professor marcou compensatória', () => {
    expect(calcNotaEncontro({
      notaTutor: 'SATISFATORIO',
      mediaInterpares: 3,
      notaAutoAvaliacao: 4,
    })).toBe('SATISFATORIO')
  })

  it('COM auto-avaliação: divisor 5 — (inter×0.5 + auto×0.5 + tutor×4) / 5', () => {
    // inter=3, auto=4, tutor=3
    // (3×0.5 + 4×0.5 + 3×4) / 5 = (1.5 + 2 + 12) / 5 = 15.5/5 = 3.1
    const nota = calcNotaEncontro({
      notaTutor: 3,
      mediaInterpares: 3,
      notaAutoAvaliacao: 4,
    })
    expect(nota).toBeCloseTo(3.1)
  })

  it('SEM auto-avaliação (aluno faltou): divisor 4.5 — (inter×0.5 + tutor×4) / 4.5', () => {
    // inter=3, tutor=3
    // (3×0.5 + 3×4) / 4.5 = (1.5 + 12) / 4.5 = 13.5/4.5 = 3.0
    const nota = calcNotaEncontro({
      notaTutor: 3,
      mediaInterpares: 3,
      notaAutoAvaliacao: null,
    })
    expect(nota).toBeCloseTo(3.0)
  })

  it('SEM interpares e SEM auto (faltou e ninguém avaliou): interpares=0, divisor 4.5', () => {
    // (0×0.5 + 4×4) / 4.5 = 16/4.5 ≈ 3.556
    const nota = calcNotaEncontro({
      notaTutor: 4,
      mediaInterpares: null,
      notaAutoAvaliacao: null,
    })
    expect(nota).toBeCloseTo(3.556, 2)
  })

  it('nota máxima — tudo 5 com auto-avaliação', () => {
    // (5×0.5 + 5×0.5 + 5×4) / 5 = (2.5+2.5+20)/5 = 25/5 = 5
    const nota = calcNotaEncontro({
      notaTutor: 5,
      mediaInterpares: 5,
      notaAutoAvaliacao: 5,
    })
    expect(nota).toBeCloseTo(5)
  })

  it('nota mínima — tudo zero com auto-avaliação', () => {
    const nota = calcNotaEncontro({
      notaTutor: 0,
      mediaInterpares: 0,
      notaAutoAvaliacao: 0,
    })
    expect(nota).toBe(0)
  })

  it('divisor muda corretamente — mesmos dados, resultado diferente com/sem auto', () => {
    const params = { notaTutor: 3 as number, mediaInterpares: 3 }
    const comAuto = calcNotaEncontro({ ...params, notaAutoAvaliacao: 3 }) as number
    const semAuto = calcNotaEncontro({ ...params, notaAutoAvaliacao: null }) as number
    // Com auto: (1.5+1.5+12)/5 = 3.0 — Sem auto: (1.5+12)/4.5 = 3.0
    // Com notas diferentes fica visível
    const comAuto2 = calcNotaEncontro({ notaTutor: 4, mediaInterpares: 2, notaAutoAvaliacao: 5 }) as number
    const semAuto2 = calcNotaEncontro({ notaTutor: 4, mediaInterpares: 2, notaAutoAvaliacao: null }) as number
    expect(comAuto2).not.toBeCloseTo(semAuto2)
  })
})

// ── calcNotaFormativa ──────────────────────────────────────────────
describe('calcNotaFormativa', () => {
  it('soma aberturas + fechamentos', () => {
    expect(calcNotaFormativa(3.5, 4.0)).toBeCloseTo(7.5)
  })

  it('limita em 10 (não passa de 10)', () => {
    expect(calcNotaFormativa(6, 6)).toBe(10)
  })

  it('nota mínima — ambas zero', () => {
    expect(calcNotaFormativa(0, 0)).toBe(0)
  })
})

// ── calcMediaAberturas ─────────────────────────────────────────────
describe('calcMediaAberturas', () => {
  it('ignora SATISFATORIO no cálculo', () => {
    const media = calcMediaAberturas([4, 'SATISFATORIO', 3])
    expect(media).toBeCloseTo(3.5) // (4+3)/2
  })

  it('ignora null no cálculo', () => {
    const media = calcMediaAberturas([4, null, 3])
    expect(media).toBeCloseTo(3.5)
  })

  it('retorna 0 se todas as notas são SATISFATORIO ou null', () => {
    expect(calcMediaAberturas(['SATISFATORIO', null])).toBe(0)
  })

  it('média de notas numéricas', () => {
    expect(calcMediaAberturas([3, 4, 5])).toBeCloseTo(4)
  })
})

// ── arredondar ─────────────────────────────────────────────────────
describe('arredondar', () => {
  it('arredonda para 2 casas', () => {
    expect(arredondar(3.7733)).toBe(3.77)
    expect(arredondar(3.7750)).toBe(3.78)
    expect(arredondar(3.005)).toBe(3.01)
  })

  it('preserva valores exatos', () => {
    expect(arredondar(4.0)).toBe(4)
    expect(arredondar(0)).toBe(0)
  })
})

// ── fmt2 ───────────────────────────────────────────────────────────
describe('fmt2', () => {
  it('formata número com 2 casas', () => {
    expect(fmt2(3.8)).toBe('3.80')
    expect(fmt2(3.77)).toBe('3.77')
  })

  it('retorna — para null', () => {
    expect(fmt2(null)).toBe('—')
  })

  it('retorna — para undefined', () => {
    expect(fmt2(undefined)).toBe('—')
  })

  it('retorna SATISFATÓRIO para a constante', () => {
    expect(fmt2('SATISFATORIO')).toBe('SATISFATÓRIO')
  })
})
