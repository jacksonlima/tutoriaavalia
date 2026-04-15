/**
 * Testes para src/lib/notas.ts
 *
 * Estas fórmulas foram migradas fielmente de planilhas do Google Sheets
 * e são a base de cálculo de toda a avaliação formativa. Um bug aqui =
 * notas erradas em produção. Os casos abaixo cobrem os cenários oficiais
 * descritos no próprio arquivo de regras.
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
  isNotaValida,
} from '../notas'

// ────────────────────────────────────────────────────────────────
// calcMedia
// ────────────────────────────────────────────────────────────────
describe('calcMedia', () => {
  it('calcula a média aritmética dos 3 critérios', () => {
    expect(calcMedia(3, 4, 5)).toBe(4)
  })

  it('aceita notas iguais', () => {
    expect(calcMedia(4, 4, 4)).toBe(4)
  })

  it('aceita zero em todos os critérios', () => {
    expect(calcMedia(0, 0, 0)).toBe(0)
  })

  it('aceita o valor máximo (5) em todos os critérios', () => {
    expect(calcMedia(5, 5, 5)).toBe(5)
  })

  it('aceita valores fracionados (4.5 permitido no dropdown)', () => {
    expect(calcMedia(4.5, 4.5, 4.5)).toBe(4.5)
  })

  it('produz resultado com dízima (tratada em arredondar depois)', () => {
    // (4 + 4 + 5) / 3 = 4.333...
    expect(calcMedia(4, 4, 5)).toBeCloseTo(4.3333, 3)
  })
})

// ────────────────────────────────────────────────────────────────
// calcMMenosAtTutor
// ────────────────────────────────────────────────────────────────
describe('calcMMenosAtTutor', () => {
  it('retorna SATISFATORIO quando atividade compensatória = true', () => {
    expect(calcMMenosAtTutor(0, 0, 0, 0, true)).toBe('SATISFATORIO')
  })

  it('retorna SATISFATORIO mesmo com notas preenchidas quando compensatória = true', () => {
    expect(calcMMenosAtTutor(5, 5, 5, 0, true)).toBe('SATISFATORIO')
  })

  it('calcula média menos atitudes quando compensatória = false', () => {
    // média (3,4,5)=4, atitudes=0.2 → 4 - 0.2 = 3.8
    expect(calcMMenosAtTutor(3, 4, 5, 0.2, false)).toBeCloseTo(3.8, 5)
  })

  it('permite atitudes = 0', () => {
    expect(calcMMenosAtTutor(4, 4, 4, 0, false)).toBe(4)
  })

  it('permite atitudes = 1 (máximo de desconto)', () => {
    expect(calcMMenosAtTutor(5, 5, 5, 1, false)).toBe(4)
  })
})

// ────────────────────────────────────────────────────────────────
// calcMMenosAtAluno
// ────────────────────────────────────────────────────────────────
describe('calcMMenosAtAluno', () => {
  it('retorna média menos atitudes (sem tratamento de compensatória)', () => {
    expect(calcMMenosAtAluno(3, 4, 5, 0.2)).toBeCloseTo(3.8, 5)
  })

  it('permite resultado negativo em teoria (atitudes alta sobre notas baixas)', () => {
    // média (0,0,0)=0, atitudes=1 → -1
    expect(calcMMenosAtAluno(0, 0, 0, 1)).toBe(-1)
  })
})

// ────────────────────────────────────────────────────────────────
// calcNotaEncontro — coração do sistema
// ────────────────────────────────────────────────────────────────
describe('calcNotaEncontro', () => {
  it('retorna null quando o tutor ainda não lançou nota', () => {
    expect(
      calcNotaEncontro({
        notaTutor: null,
        mediaInterpares: 3,
        notaAutoAvaliacao: 4,
      })
    ).toBeNull()
  })

  it('retorna SATISFATORIO quando tutor marca atividade compensatória', () => {
    expect(
      calcNotaEncontro({
        notaTutor: 'SATISFATORIO',
        mediaInterpares: 3,
        notaAutoAvaliacao: 4,
      })
    ).toBe('SATISFATORIO')
  })

  it('aplica a fórmula /5 quando todos os 3 componentes existem', () => {
    // (3×0,5 + 4×0,5 + 5×4) / 5 = (1,5 + 2 + 20) / 5 = 23,5 / 5 = 4,7
    expect(
      calcNotaEncontro({
        notaTutor: 5,
        mediaInterpares: 3,
        notaAutoAvaliacao: 4,
      })
    ).toBeCloseTo(4.7, 5)
  })

  it('aplica a fórmula /4,5 quando auto-avaliação ausente (aluno faltou)', () => {
    // (3×0,5 + 5×4) / 4,5 = (1,5 + 20) / 4,5 = 21,5 / 4,5 ≈ 4,7777...
    expect(
      calcNotaEncontro({
        notaTutor: 5,
        mediaInterpares: 3,
        notaAutoAvaliacao: null,
      })
    ).toBeCloseTo(4.7777, 3)
  })

  it('trata interpares null como 0 (ninguém avaliou ainda)', () => {
    // (0×0,5 + 4×0,5 + 5×4) / 5 = (0 + 2 + 20) / 5 = 4,4
    expect(
      calcNotaEncontro({
        notaTutor: 5,
        mediaInterpares: null,
        notaAutoAvaliacao: 4,
      })
    ).toBeCloseTo(4.4, 5)
  })

  it('trata interpares null E auto null juntos (só professor lançou)', () => {
    // (0×0,5 + 5×4) / 4,5 = 20/4,5 ≈ 4,4444...
    expect(
      calcNotaEncontro({
        notaTutor: 5,
        mediaInterpares: null,
        notaAutoAvaliacao: null,
      })
    ).toBeCloseTo(4.4444, 3)
  })

  it('calcula nota máxima quando tudo é 5', () => {
    // (5×0,5 + 5×0,5 + 5×4) / 5 = 25/5 = 5
    expect(
      calcNotaEncontro({
        notaTutor: 5,
        mediaInterpares: 5,
        notaAutoAvaliacao: 5,
      })
    ).toBe(5)
  })

  it('calcula nota mínima quando tudo é 0', () => {
    expect(
      calcNotaEncontro({
        notaTutor: 0,
        mediaInterpares: 0,
        notaAutoAvaliacao: 0,
      })
    ).toBe(0)
  })

  it('professor tem peso dominante (80% quando auto presente)', () => {
    // Tutor alto, interpares e auto baixos: nota tende ao tutor
    // (0×0,5 + 0×0,5 + 5×4) / 5 = 20/5 = 4
    const nota = calcNotaEncontro({
      notaTutor: 5,
      mediaInterpares: 0,
      notaAutoAvaliacao: 0,
    }) as number
    expect(nota).toBe(4)
    expect(nota).toBeGreaterThan(3) // peso do professor domina
  })

  it('sem auto, peso do professor cresce (~89%)', () => {
    // (0×0,5 + 5×4) / 4,5 = 20/4,5 ≈ 4,44
    const nota = calcNotaEncontro({
      notaTutor: 5,
      mediaInterpares: 0,
      notaAutoAvaliacao: null,
    }) as number
    expect(nota).toBeCloseTo(4.4444, 3)
  })
})

// ────────────────────────────────────────────────────────────────
// calcMediaAberturas / calcMediaFechamentos
// ────────────────────────────────────────────────────────────────
describe('calcMediaAberturas', () => {
  it('calcula média simples de notas numéricas', () => {
    expect(calcMediaAberturas([3, 4, 5])).toBe(4)
  })

  it('ignora SATISFATORIO no cálculo', () => {
    // (3 + 5) / 2 = 4  (o SATISFATORIO é excluído)
    expect(calcMediaAberturas([3, 'SATISFATORIO', 5])).toBe(4)
  })

  it('ignora null (problema sem nota ainda)', () => {
    expect(calcMediaAberturas([3, null, 5])).toBe(4)
  })

  it('ignora SATISFATORIO e null simultaneamente', () => {
    expect(calcMediaAberturas([4, 'SATISFATORIO', null, 4])).toBe(4)
  })

  it('retorna 0 quando todas as notas são SATISFATORIO ou null', () => {
    expect(calcMediaAberturas(['SATISFATORIO', null, 'SATISFATORIO'])).toBe(0)
  })

  it('retorna 0 para array vazio', () => {
    expect(calcMediaAberturas([])).toBe(0)
  })

  it('aceita uma única nota numérica', () => {
    expect(calcMediaAberturas([4.5])).toBe(4.5)
  })
})

describe('calcMediaFechamentos', () => {
  it('comporta-se igual a calcMediaAberturas (mesma fórmula)', () => {
    expect(calcMediaFechamentos([3, 4, 5])).toBe(calcMediaAberturas([3, 4, 5]))
    expect(calcMediaFechamentos([3, 'SATISFATORIO', 5])).toBe(4)
  })
})

// ────────────────────────────────────────────────────────────────
// calcNotaFormativa
// ────────────────────────────────────────────────────────────────
describe('calcNotaFormativa', () => {
  it('soma as médias de abertura e fechamento', () => {
    expect(calcNotaFormativa(4, 4)).toBe(8)
  })

  it('retorna a soma quando ainda está abaixo do teto', () => {
    expect(calcNotaFormativa(3, 5)).toBe(8)
  })

  it('limita ao teto de 10 (cap)', () => {
    // Soma seria 10, deve retornar 10
    expect(calcNotaFormativa(5, 5)).toBe(10)
  })

  it('limita ao teto de 10 mesmo quando a soma ultrapassa', () => {
    // Hipotético: médias muito altas, soma>10 → 10
    expect(calcNotaFormativa(6, 6)).toBe(10)
  })

  it('lida com médias zero', () => {
    expect(calcNotaFormativa(0, 0)).toBe(0)
  })

  it('funciona com apenas uma metade com notas', () => {
    expect(calcNotaFormativa(4, 0)).toBe(4)
    expect(calcNotaFormativa(0, 4)).toBe(4)
  })
})

// ────────────────────────────────────────────────────────────────
// arredondar
// ────────────────────────────────────────────────────────────────
describe('arredondar', () => {
  it('arredonda para 2 casas decimais (caso do exemplo: 3.7733 → 3.77)', () => {
    expect(arredondar(3.7733)).toBe(3.77)
  })

  it('arredonda para cima quando terceira casa ≥ 5', () => {
    expect(arredondar(3.775)).toBe(3.78)
  })

  it('preserva valores já arredondados', () => {
    expect(arredondar(3.5)).toBe(3.5)
    expect(arredondar(0)).toBe(0)
  })

  it('arredonda zero corretamente', () => {
    expect(arredondar(0.001)).toBe(0)
  })

  it('funciona com valores negativos (com ponto flutuante típico)', () => {
    // Observação: -1.235 * 100 em float produz -123.5000...001, então
    // Math.round retorna -124 → -1.24. Documenta o comportamento atual
    // de arredondar; as notas reais são sempre ≥ 0, então isso não afeta
    // a regra de negócio — o teste existe para evitar regressão silenciosa.
    expect(arredondar(-1.235)).toBe(-1.24)
    expect(arredondar(-3.7733)).toBe(-3.77)
  })
})

// ────────────────────────────────────────────────────────────────
// fmt2
// ────────────────────────────────────────────────────────────────
describe('fmt2', () => {
  it('formata número com 2 casas decimais fixas', () => {
    expect(fmt2(3.8)).toBe('3.80')
    expect(fmt2(3.77)).toBe('3.77')
  })

  it('retorna travessão para null', () => {
    expect(fmt2(null)).toBe('—')
  })

  it('retorna travessão para undefined', () => {
    expect(fmt2(undefined)).toBe('—')
  })

  it('converte SATISFATORIO em SATISFATÓRIO (com acento para exibição)', () => {
    expect(fmt2('SATISFATORIO')).toBe('SATISFATÓRIO')
  })

  it('converte abreviação SAT em SATISFATÓRIO', () => {
    expect(fmt2('SAT')).toBe('SATISFATÓRIO')
  })

  it('devolve string arbitrária sem alterações', () => {
    expect(fmt2('N/A')).toBe('N/A')
  })

  it('formata zero com duas casas', () => {
    expect(fmt2(0)).toBe('0.00')
  })

  it('formata valores com mais de 2 casas truncando (toFixed arredonda)', () => {
    expect(fmt2(3.456)).toBe('3.46')
  })
})

// ────────────────────────────────────────────────────────────────
// isNotaValida
// ────────────────────────────────────────────────────────────────
describe('isNotaValida', () => {
  it('aceita valores no intervalo [0, 5]', () => {
    expect(isNotaValida(0)).toBe(true)
    expect(isNotaValida(2.5)).toBe(true)
    expect(isNotaValida(5)).toBe(true)
  })

  it('rejeita valores abaixo de 0', () => {
    expect(isNotaValida(-0.01)).toBe(false)
    expect(isNotaValida(-1)).toBe(false)
  })

  it('rejeita valores acima de 5', () => {
    expect(isNotaValida(5.01)).toBe(false)
    expect(isNotaValida(10)).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────
// Cenários de integração das fórmulas (end-to-end de um aluno)
// ────────────────────────────────────────────────────────────────
describe('Cenário integrado: aluno ao longo do módulo', () => {
  it('aluno regular: 2 aberturas e 2 fechamentos numéricos', () => {
    const notasAbertura = [
      calcNotaEncontro({ notaTutor: 5, mediaInterpares: 4, notaAutoAvaliacao: 4 }),
      calcNotaEncontro({ notaTutor: 4, mediaInterpares: 4, notaAutoAvaliacao: 4 }),
    ]
    const notasFechamento = [
      calcNotaEncontro({ notaTutor: 5, mediaInterpares: 5, notaAutoAvaliacao: 4 }),
      calcNotaEncontro({ notaTutor: 4, mediaInterpares: 4, notaAutoAvaliacao: 3 }),
    ]

    const mAbertura = calcMediaAberturas(notasAbertura)
    const mFechamento = calcMediaFechamentos(notasFechamento)
    const formativa = calcNotaFormativa(mAbertura, mFechamento)

    expect(arredondar(formativa)).toBeLessThanOrEqual(10)
    expect(formativa).toBeGreaterThan(0)
  })

  it('aluno com 1 compensatória: nota SATISFATORIO é excluída da média', () => {
    const notas = [
      calcNotaEncontro({ notaTutor: 4, mediaInterpares: 4, notaAutoAvaliacao: 4 }),
      calcNotaEncontro({ notaTutor: 'SATISFATORIO', mediaInterpares: 4, notaAutoAvaliacao: 4 }),
      calcNotaEncontro({ notaTutor: 5, mediaInterpares: 5, notaAutoAvaliacao: 5 }),
    ]
    // Deve incluir 2 notas numéricas apenas
    const media = calcMediaAberturas(notas)
    expect(media).toBeGreaterThan(0)
    // O SATISFATORIO não zera a média (se zerasse, a média cairia para 2/3 do valor)
    expect(media).toBeGreaterThan(4)
  })

  it('aluno faltoso em todos os encontros: todas as notas têm divisor 4,5', () => {
    const notas = [
      calcNotaEncontro({ notaTutor: 3, mediaInterpares: 3, notaAutoAvaliacao: null }),
      calcNotaEncontro({ notaTutor: 4, mediaInterpares: 3, notaAutoAvaliacao: null }),
    ]
    notas.forEach((n) => expect(n).not.toBeNull())
    expect(notas[0]).toBeCloseTo((3 * 0.5 + 3 * 4) / 4.5, 5)
  })

  it('nota formativa nunca ultrapassa 10 mesmo em cenário extremo', () => {
    // Se todas as notas forem 5, média abertura=5 e fechamento=5 → soma=10
    const notasAbertura = Array(3).fill(null).map(() =>
      calcNotaEncontro({ notaTutor: 5, mediaInterpares: 5, notaAutoAvaliacao: 5 })
    )
    const notasFechamento = Array(3).fill(null).map(() =>
      calcNotaEncontro({ notaTutor: 5, mediaInterpares: 5, notaAutoAvaliacao: 5 })
    )

    const formativa = calcNotaFormativa(
      calcMediaAberturas(notasAbertura),
      calcMediaFechamentos(notasFechamento)
    )
    expect(formativa).toBe(10)
  })
})
