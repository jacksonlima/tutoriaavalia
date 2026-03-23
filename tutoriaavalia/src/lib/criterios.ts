/**
 * criterios.ts
 * Definição centralizada dos critérios de avaliação, seus nomes,
 * opções de nota e tipo de encontro.
 * Usado tanto no formulário do tutor quanto no formulário do aluno.
 */

export type CampoNota = 'c1' | 'c2' | 'c3' | 'atitudes'

export interface Criterio {
  campo:  CampoNota
  label:  string   // código curto exibido na tabela (ex: "1.1")
  nome:   string   // descrição completa exibida no formulário
  opcoes: number[] // valores disponíveis no dropdown
}

// ─── Opções de nota por tipo de critério ────────────────────────────────────

/** Critérios padrão: 0, 1, 2, 3, 4, 5 */
const OPCOES_PADRAO = [0, 1.0, 2.0, 3.0, 4.0, 5.0]

/** Critérios especiais: incluem 4.5 — 1.2 (Abertura) e 2.1 (Fechamento) */
const OPCOES_COM_45  = [0, 1.0, 2.0, 3.0, 4.0, 4.5, 5.0]

/** Atitudes: escala de 0 a 1 em incrementos de 0.2 */
export const OPCOES_ATITUDES = [0, 0.2, 0.4, 0.6, 0.8, 1.0]

// ─── Critérios da ABERTURA (encontro 1) ─────────────────────────────────────

export const CRITERIOS_ABERTURA: Criterio[] = [
  {
    campo:  'c1',
    label:  '1.1',
    nome:   'Identifica questões e gera hipóteses no problema apresentado?',
    opcoes: OPCOES_PADRAO,
  },
  {
    campo:  'c2',
    label:  '1.2',
    nome:   'Utiliza conhecimentos prévios?',
    opcoes: OPCOES_COM_45,   // inclui 4.5
  },
  {
    campo:  'c3',
    label:  '1.3',
    nome:   'Participa ativamente do grupo?',
    opcoes: OPCOES_PADRAO,
  },
]

// ─── Critérios do FECHAMENTO (encontro 2) ───────────────────────────────────
// Mesmo conjunto para FECHAMENTO, FECHAMENTO_A e FECHAMENTO_B

export const CRITERIOS_FECHAMENTO: Criterio[] = [
  {
    campo:  'c1',
    label:  '2.1',
    nome:   'Demonstra estudo prévio?',
    opcoes: OPCOES_COM_45,   // inclui 4.5
  },
  {
    campo:  'c2',
    label:  '2.2',
    nome:   'Demonstra capacidade de sintetizar e expor as informações de forma organizada?',
    opcoes: OPCOES_PADRAO,
  },
  {
    campo:  'c3',
    label:  '2.3',
    nome:   'Apresenta atitude crítica em relação às informações trazidas?',
    opcoes: OPCOES_PADRAO,
  },
]

// ─── Seletor por tipo de encontro ───────────────────────────────────────────

export type TipoEncontroForm =
  | 'ABERTURA'
  | 'FECHAMENTO'
  | 'FECHAMENTO_A'
  | 'FECHAMENTO_B'

/**
 * Retorna os critérios corretos conforme o tipo de encontro.
 * Abertura → critérios 1.x
 * Fechamento / Fechamento A / Fechamento B → critérios 2.x
 */
export function getCriterios(tipo: TipoEncontroForm): Criterio[] {
  return tipo === 'ABERTURA' ? CRITERIOS_ABERTURA : CRITERIOS_FECHAMENTO
}

/**
 * Label legível para exibir no cabeçalho do formulário.
 */
export function getLabelTipo(tipo: TipoEncontroForm): string {
  switch (tipo) {
    case 'ABERTURA':    return 'Abertura'
    case 'FECHAMENTO':  return 'Fechamento'
    case 'FECHAMENTO_A': return 'Fechamento A (Salto Triplo)'
    case 'FECHAMENTO_B': return 'Fechamento B (Salto Triplo)'
  }
}
