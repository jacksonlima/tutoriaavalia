import { PrismaClient, Papel } from '@prisma/client'
const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────
// Limpa tudo na ordem correta de FK
// ─────────────────────────────────────────────────────────────────
async function limparTudo() {
  console.log('🗑️  Limpando banco...')
  await prisma.encontroEspecial.deleteMany()
  await prisma.coTutorPermissao.deleteMany()
  await prisma.coTutor.deleteMany()
  await prisma.avaliacaoTutor.deleteMany()
  await prisma.avaliacaoAluno.deleteMany()
  await prisma.submissao.deleteMany()
  await prisma.problema.deleteMany()
  await prisma.matricula.deleteMany()
  await prisma.modulo.deleteMany()
  await prisma.usuario.deleteMany()
  console.log('   Limpo ✅\n')
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
async function criarTutor(email: string, nome: string) {
  return prisma.usuario.create({ data: { email, nome, papel: Papel.TUTOR } })
}

async function criarAluno(email: string, nome: string) {
  return prisma.usuario.create({ data: { email, nome, papel: Papel.ALUNO } })
}

async function criarModulo(
  tutorId: string, nome: string, tutoria: string, turma: string, ano: number
) {
  return prisma.modulo.create({
    data: { nome, ano, tutoria, turma, tutorId, ativo: true, arquivado: false },
  })
}

async function matricular(moduloId: string, alunos: { id: string }[]) {
  for (let i = 0; i < alunos.length; i++) {
    await prisma.matricula.create({
      data: { moduloId, usuarioId: alunos[i].id, numeraNaTurma: i + 1 },
    })
  }
}

async function criarProblemas(moduloId: string, probs: any[]) {
  for (const p of probs) {
    await prisma.problema.create({ data: { moduloId, ...p } })
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  TutoriaAvalia — Seed de Ambiente de Testes')
  console.log('═══════════════════════════════════════════════════════\n')

  await limparTudo()

  // ══════════════════════════════════════════════════════════════
  // MÓDULO: Implicações do Crescimento e da Diferenciação Celular
  // 8 tutorias · 8 tutores · 10 alunos cada · Turma MD2 · 2025
  // ══════════════════════════════════════════════════════════════
  const NOME_MODULO = 'Implicações do Crescimento e da Diferenciação Celular'
  const TURMA       = 'MD2'
  const ANO         = 2025

  const PROBLEMAS = [
    {
      numero: 1, nome: 'Problema 01 — Crescimento Controlado',
      aberturaAtiva: true, fechamentoAtivo: false,
      temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
    },
    {
      numero: 2, nome: 'Problema 02 — Quando o Controle Falha',
      aberturaAtiva: false, fechamentoAtivo: false,
      temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
    },
    {
      numero: 3, nome: 'Problema 03 — Diferenciação e Destino Celular (ST)',
      aberturaAtiva: false, fechamentoAtivo: false,
      temSaltoTriplo: true, fechamentoAAtivo: false, fechamentoBAtivo: false,
    },
  ]

  // ── 8 Tutores ────────────────────────────────────────────────
  console.log('👥 Criando tutores...')
  const tutores = [
    { email: 'alexandre@prof.cesupa.br',  nome: 'Alexandre'  },
    { email: 'ciane@prof.cesupa.br',       nome: 'Ciane'      },
    { email: 'ismari@prof.cesupa.br',      nome: 'Ismari'     },
    { email: 'jackson.lima@prof.cesupa.br', nome: 'Jackson Lima' },
    { email: 'paloma@prof.cesupa.br',      nome: 'Paloma'     },
    { email: 'rosana@prof.cesupa.br',      nome: 'Rosana'     },
    { email: 'valdenira@prof.cesupa.br',   nome: 'Valdenira'  },
    { email: 'valeria@prof.cesupa.br',     nome: 'Valéria'    },
  ]

  const tutoresDb: Record<string, any> = {}
  for (const t of tutores) {
    tutoresDb[t.nome] = await criarTutor(t.email, t.nome)
    console.log(`   ✅ ${t.nome} (${t.email})`)
  }
  console.log()

  // ── 8 Tutorias × 10 alunos cada ────────────────────────────
  const tutorias = [
    { label: 'Tutoria 1', tutor: 'Alexandre',   prefix: 'tu1' },
    { label: 'Tutoria 2', tutor: 'Ciane',        prefix: 'tu2' },
    { label: 'Tutoria 3', tutor: 'Ismari',       prefix: 'tu3' },
    { label: 'Tutoria 4', tutor: 'Jackson Lima', prefix: 'tu4' },
    { label: 'Tutoria 5', tutor: 'Paloma',       prefix: 'tu5' },
    { label: 'Tutoria 6', tutor: 'Rosana',       prefix: 'tu6' },
    { label: 'Tutoria 7', tutor: 'Valdenira',    prefix: 'tu7' },
    { label: 'Tutoria 8', tutor: 'Valéria',      prefix: 'tu8' },
  ]

  // Nomes para deixar o seed mais realista
  const NOMES = [
    ['Ana Beatriz',   'Bruno',     'Camila',   'Daniel',  'Eduarda'],
    ['Felipe',        'Gabriela',  'Henrique', 'Isabela', 'João'],
    ['Karen',         'Leonardo',  'Mariana',  'Nicolas', 'Olivia'],
    ['Pedro',         'Rafaela',   'Samuel',   'Thaís',   'Ubiratan'],
    ['Valentina',     'Wagner',    'Ximena',   'Yuri',    'Zelda'],
    ['Adriana',       'Breno',     'Cecília',  'Diego',   'Elisa'],
    ['Flávia',        'Gustavo',   'Helena',   'Igor',    'Joana'],
    ['Kauã',          'Luiza',     'Marcos',   'Nathalia','Otto'],
  ]

  for (let ti = 0; ti < tutorias.length; ti++) {
    const tut = tutorias[ti]
    console.log(`📚 ${tut.label} — Prof. ${tut.tutor}`)

    const alunos = []
    for (let ai = 0; ai < 10; ai++) {
      const nomeBase = NOMES[ti][ai] ?? `Aluno ${ai + 1}`
      const email    = `${tut.prefix}.a${String(ai + 1).padStart(2,'0')}@aluno.cesupa.br`
      const aluno    = await criarAluno(email, `${nomeBase} (${tut.label})`)
      alunos.push(aluno)
    }

    const modulo = await criarModulo(
      tutoresDb[tut.tutor].id,
      NOME_MODULO,
      tut.label,
      TURMA,
      ANO
    )

    await matricular(modulo.id, alunos)
    await criarProblemas(modulo.id, PROBLEMAS)

    console.log(`   ✅ Módulo criado · 10 alunos · 3 problemas (P3=Salto Triplo)\n`)
  }

  // ── Resumo ───────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SEED CONCLUÍDO')
  console.log('═══════════════════════════════════════════════════════\n')
  console.log(`  Módulo: ${NOME_MODULO}`)
  console.log(`  Turma: ${TURMA} · Ano: ${ANO}`)
  console.log(`  8 tutorias · 80 alunos · 3 problemas cada\n`)
  console.log('  ACESSO:')
  console.log('  → Tutores: http://localhost:3000/dev/login')
  console.log('  → Alunos:  http://localhost:3000/dev/login\n')
  console.log('  TUTORES:')
  for (const t of tutores) {
    console.log(`    ${t.nome.padEnd(15)} ${t.email}`)
  }
  console.log()
  console.log('  TESTE DE REALOCAÇÃO:')
  console.log('  1. Logar como Jackson Lima')
  console.log('  2. Abrir Tutoria 4 → "🔄 Encontros Especiais → Gerenciar"')
  console.log('  3. Deve ver Alexandre, Ciane, Ismari, Paloma, Rosana, Valdenira, Valéria')
  console.log('  4. Realocar alunos da Tutoria 4 entre as outras 7 tutorias')
  console.log()
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
