/**
 * TutoriaAvalia v2
 * Autor: Jackson Lima — CESUPA
 * Sistema de avaliação formativa para Aprendizagem Baseada em Problemas (ABP)
 */
/**
 * notas.ts
 * ─────────────────────────────────────────────────────────────────
 * Lógica de cálculo de notas — migração fiel das fórmulas do Google Sheets.
 *
 * PRECISÃO: 2 casas decimais em todos os resultados numéricos.
 *
 * PESOS na nota do encontro (fórmula principal):
 *   Professor    → × 4   (80 % quando há auto-avaliação; ~89 % sem ela)
 *   Interpares   → × 0,5 (média de todos os OUTROS alunos avaliando este aluno)
 *   Auto-aval    → × 0,5 (apenas quando submetida; excluída se aluno não avaliou)
 *
 * SATISFATÓRIO: quando o professor marca Atividade Compensatória,
 *   a nota do encontro é SATISFATÓRIO e esse valor é EXCLUÍDO
 *   do cálculo das médias de abertura/fechamento.
 */

// ─────────────────────────────────────────────────────────────────
// CÁLCULOS INTERMEDIÁRIOS
// ─────────────────────────────────────────────────────────────────

/** Média simples dos 3 critérios. Planilha: =AVERAGE(B4:D4) */
export function calcMedia(c1: number, c2: number, c3: number): number {
  return (c1 + c2 + c3) / 3
}

/**
 * M menos Atitudes para o TUTOR.
 * Se atividade compensatória = true → retorna 'SATISFATORIO'
 * Planilha: =SE(H4=VERDADEIRO;"SATISFATÓRIO";(E4-F4))
 */
export function calcMMenosAtTutor(
  c1: number,
  c2: number,
  c3: number,
  atitudes: number,
  ativCompensatoria: boolean
): number | 'SATISFATORIO' {
  if (ativCompensatoria) return 'SATISFATORIO'
  return calcMedia(c1, c2, c3) - atitudes
}

/**
 * M menos Atitudes para o ALUNO (sem compensatória).
 * Planilha: =E4-F4
 */
export function calcMMenosAtAluno(
  c1: number,
  c2: number,
  c3: number,
  atitudes: number
): number {
  return calcMedia(c1, c2, c3) - atitudes
}

// ─────────────────────────────────────────────────────────────────
// NOTA FINAL DO ENCONTRO
// ─────────────────────────────────────────────────────────────────

export type NotaEncontroInput = {
  notaTutor:         number | 'SATISFATORIO' | null
  mediaInterpares:   number | null
  /**
   * null = aluno não avaliou (faltou) → tratado como 0,0
   * null = interpares sem avaliações → tratado como 0,0
   */
  notaAutoAvaliacao: number | null
}

/**
 * Fórmula do encontro — fiel à planilha Google Sheets:
 *
 *   Com auto-avaliação:    (interpares×0,5 + auto×0,5 + professor×4) / 5
 *   Sem auto-avaliação:    (interpares×0,5 + professor×4)             / 4,5
 *
 * O divisor muda conforme os componentes presentes:
 *   - auto existe  → peso total = 0,5+0,5+4 = 5   → divide por 5
 *   - auto ausente → peso total = 0,5+4   = 4,5   → divide por 4,5
 *
 * Isso equivale à fórmula da planilha:
 *   =IF(O="MR","MR",IF(ISERR(autoCell),(inter×0,5+tutor×4)/4,5,
 *                                      (inter×0,5+auto×0,5+tutor×4)/5))
 *
 * ALUNO FALTOSO (não enviou auto-avaliação):
 *   → notaAutoAvaliacao = null → usa divisor 4,5
 *   → As notas interpares DELE são ignoradas no cálculo dos colegas (campo faltou=true)
 *
 * Retorna:
 *   null           — professor ainda não lançou nota (dados insuficientes)
 *   'SATISFATORIO' — atividade compensatória marcada pelo professor
 *   number         — nota calculada (0,00 a 5,00)
 */
export function calcNotaEncontro(
  params: NotaEncontroInput
): number | 'SATISFATORIO' | null {
  const { notaTutor, mediaInterpares, notaAutoAvaliacao } = params

  // Sem nota do professor = encontro sem dados (professor não lançou)
  if (notaTutor === null) return null

  // Atividade compensatória
  if (notaTutor === 'SATISFATORIO') return 'SATISFATORIO'

  // Interpares: se ninguém avaliou → 0 (inclui com peso 0,5 mesmo assim)
  const inter = mediaInterpares ?? 0

  if (notaAutoAvaliacao === null) {
    // Aluno não enviou auto-avaliação (faltou): remove o peso 0,5 do auto
    // Divisor = 0,5 (inter) + 4 (tutor) = 4,5
    return (inter * 0.5 + notaTutor * 4) / 4.5
  }

  // Aluno presente: todos os três componentes, divisor = 5
  return (inter * 0.5 + notaAutoAvaliacao * 0.5 + notaTutor * 4) / 5
}

// ─────────────────────────────────────────────────────────────────
// NOTA FORMATIVA FINAL (Resumo MT)
// ─────────────────────────────────────────────────────────────────

/**
 * Média das notas numéricas de abertura, ignorando SATISFATÓRIO e null.
 * Planilha: =MÉDIASE({...};"<>#DIV/0!")
 */
export function calcMediaAberturas(notas: (number | 'SATISFATORIO' | null)[]): number {
  const numericas = notas.filter((n): n is number => typeof n === 'number')
  if (numericas.length === 0) return 0
  return numericas.reduce((a, b) => a + b, 0) / numericas.length
}

export function calcMediaFechamentos(notas: (number | 'SATISFATORIO' | null)[]): number {
  return calcMediaAberturas(notas)
}

/**
 * Nota formativa = SOMA das médias (máx 10).
 * Planilha: =SUM(R4+S4)  — SOMA, não média!
 */
export function calcNotaFormativa(
  mediaAberturas: number,
  mediaFechamentos: number
): number {
  return Math.min(mediaAberturas + mediaFechamentos, 10)
}

// ─────────────────────────────────────────────────────────────────
// FORMATAÇÃO — 2 CASAS DECIMAIS
// ─────────────────────────────────────────────────────────────────

/** Arredonda para 2 casas decimais. Ex: 3.7733 → 3.77 */
export function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Formata para exibição com 2 casas decimais fixas.
 *   3.8        → "3.80"
 *   3.77       → "3.77"
 *   null/undef → "—"
 *   'SATISFATORIO' ou 'SAT' → "SATISFATÓRIO"
 */
export function fmt2(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  if (valor === 'SATISFATORIO' || valor === 'SAT') return 'SATISFATÓRIO'
  if (typeof valor === 'string') return valor
  return valor.toFixed(2)
}

/** Verifica se um valor está no intervalo válido (0 a 5) */
export function isNotaValida(valor: number): boolean {
  return valor >= 0 && valor <= 5
}
