/**
 * TutoriaAvalia v2
 * Autor: Jackson Lima — CESUPA
 * Sistema de avaliação formativa para Aprendizagem Baseada em Problemas (ABP)
 * * ARQUIVO DE VALIDAÇÕES (ZOD)
 * Estas regras garantem que nenhum dado malicioso ou mal formatado
 * chegue ao banco de dados Neon, blindando as Server Actions.
 */
import { z } from 'zod'

// ── Tipos Base ────────────────────────────────────────────────────

// Nota para critérios (0-5), aceita valores do dropdown incluindo 4.5
const notaSchema = z
  .number({ required_error: 'Campo obrigatório', invalid_type_error: 'Deve ser um número' })
  .min(0, 'Mínimo: 0')
  .max(5, 'Máximo: 5')

// Nota para atitudes (0-1 em passos de 0.2)
const atitudesSchema = z
  .number({ required_error: 'Campo obrigatório', invalid_type_error: 'Deve ser um número' })
  .min(0, 'Mínimo: 0')
  .max(1, 'Máximo: 1')

// ── Opções Fixas (Enums) ──────────────────────────────────────────

export const OPCOES_TUTORIA = [
  'Tutoria 1', 'Tutoria 2', 'Tutoria 3', 'Tutoria 4',
  'Tutoria 5', 'Tutoria 6', 'Tutoria 7', 'Tutoria 8',
  'Tutoria Extra 1', 'Tutoria Extra 2', 'Tutoria Extra 3',
] as const

export const OPCOES_TURMA = ['MD1','MD2','MD3','MD4','MD5','MD6','MD7','MD8'] as const

export const OPCOES_SEMESTRE = ['01', '02'] as const

// Nomes dos módulos — lista oficial CESUPA
export const OPCOES_MODULO = [
  'I - Introdução ao Estudo da Medicina',
  'II - Implicações no Crescimento e Diferenciação Celular',
  'III - Ataque e Defesa',
  'IV - Sistema Nervoso',
  'V - Locomoção',
  'VI - Pele e Anexos',
  'VII - Sistema Cardiovascular',
  'VIII - Sistema Respiratório',
  'IX - Sistema Urinário',
  'X - Sistema Endocrinológico',
  'XI - Sistema Digestório',
  'XII - Sistema Hematológico',
  'XIII - Nascimento, Crescimento e Desenvolvimento',
  'XIV - Reprodução e Sexualidade',
  'XV - Envelhecimento',
  'XVI - Bases Bioquímicas e Terapêuticas',
  'XVII - Mente e Cérebro',
  'XVIII - Medicina Baseada em Evidências',
  'XIX - Apresentações Clínicas 1',
  'XX - Apresentações Clínicas 2',
  'XXI - Apresentações Clínicas 3',
  'XXII - Apresentações Clínicas 4: Urgência e Emergência',
  'XXIII - Apresentações Clínicas 5: Clínica Pediátrica',
  'XXIV - Apresentações Clínicas 6: Ginecologia e Obstetrícia',
] as const

// ── Schemas de Módulo ─────────────────────────────────────────────

export const criarModuloSchema = z.object({
  nome:      z.enum(OPCOES_MODULO, { required_error: 'Selecione o módulo' }),
  ano:       z.number().int().min(2020).max(2100),
  semestre:  z.enum(OPCOES_SEMESTRE, { required_error: 'Selecione o semestre' }),
  tutoria:   z.enum(OPCOES_TUTORIA, { required_error: 'Selecione a tutoria' }),
  turma:     z.enum(OPCOES_TURMA,   { required_error: 'Selecione a turma'  }),

  emailsAlunos: z
    .array(z.string().email('Email inválido'))
    .min(1, 'Adicione pelo menos 1 aluno')
    .max(11, 'Máximo de 11 alunos'),

  // Problemas — dinâmicos conforme quantidade informada
  quantidadeProblemas: z.number().int().min(1, 'Mínimo 1 problema').max(20),
  nomesProblemas:      z.array(z.string().max(120)),

  // Salto Triplo
  temSaltoTriplo:       z.boolean().default(false),
  quantidadeSaltos:     z.number().int().min(1).max(10).optional(),
  problemasSaltoTriplo: z.array(z.number().int().min(1)).optional(),
})

// Exporta a tipagem perfeita para o TypeScript usar nas Server Actions
export type CriarModuloInput = z.infer<typeof criarModuloSchema>

// ── Editar Módulo ─────────────────────────────────────────────────
// Todos os campos opcionais exceto os de identidade
export const editarModuloSchema = z.object({
  nome:     z.enum(OPCOES_MODULO, { required_error: 'Selecione o módulo' }),
  ano:      z.number().int().min(2020).max(2100),
  semestre: z.enum(OPCOES_SEMESTRE, { required_error: 'Selecione o semestre' }).optional(),
  tutoria:  z.enum(OPCOES_TUTORIA, { required_error: 'Selecione a tutoria' }),
  turma:    z.enum(OPCOES_TURMA,   { required_error: 'Selecione a turma'  }),

  // Alunos: lista de emails atual (o servidor calcula adds/removes)
  emailsAlunos: z
    .array(z.string().email('Email inválido'))
    .min(1, 'Adicione pelo menos 1 aluno')
    .max(11, 'Máximo de 11 alunos'),

  nomesProblemas: z.array(z.string().max(120)),
})

export type EditarModuloInput = z.infer<typeof editarModuloSchema>

// ── Avaliação do Tutor ────────────────────────────────────────────
const TIPOS_ENCONTRO = ['ABERTURA', 'FECHAMENTO', 'FECHAMENTO_A', 'FECHAMENTO_B'] as const

const avaliacaoIndividualTutorSchema = z.object({
  avaliadoId:        z.string().uuid(),
  c1:                notaSchema,      
  c2:                notaSchema,      
  c3:                notaSchema,      
  atitudes:          atitudesSchema,  
  ativCompensatoria: z.boolean().default(false),
  faltou:            z.boolean().default(false),
})

export const avaliacaoTutorSchema = z.object({
  problemaId:   z.string().uuid(),
  tipoEncontro: z.enum(TIPOS_ENCONTRO),
  // Valida que o envio possui pelo menos 1 aluno e no máximo 11 (tamanho do grupo PBL)
  avaliacoes:   z.array(avaliacaoIndividualTutorSchema).min(1).max(11),
})

export type AvaliacaoTutorInput = z.infer<typeof avaliacaoTutorSchema>

// ── Avaliação do Aluno ────────────────────────────────────────────
const avaliacaoIndividualAlunoSchema = z.object({
  avaliadoId: z.string().uuid(),
  c1:         notaSchema,
  c2:         notaSchema,
  c3:         notaSchema,
  atitudes:   atitudesSchema,
})

export const avaliacaoAlunoSchema = z.object({
  problemaId:   z.string().uuid(),
  tipoEncontro: z.enum(TIPOS_ENCONTRO),
  avaliacoes:   z.array(avaliacaoIndividualAlunoSchema).min(1).max(11),
})

export type AvaliacaoAlunoInput = z.infer<typeof avaliacaoAlunoSchema>

// ── Ativar / Desativar Encontro ───────────────────────────────────
export const ativarEncontroSchema = z.object({
  problemaId:   z.string().uuid(),
  tipoEncontro: z.enum(TIPOS_ENCONTRO),
  ativo:        z.boolean(),
})

export type AtivarEncontroInput = z.infer<typeof ativarEncontroSchema>