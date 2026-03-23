import { PrismaClient, Papel } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────
// LIMPA TODO O BANCO — na ordem correta de chaves estrangeiras
// ─────────────────────────────────────────────────────────────────
async function limparTudo() {
  console.log('🗑️  Limpando banco de dados...')
  await prisma.avaliacaoTutor.deleteMany()
  await prisma.avaliacaoAluno.deleteMany()
  await prisma.submissao.deleteMany()
  await prisma.problema.deleteMany()
  await prisma.matricula.deleteMany()
  await prisma.modulo.deleteMany()
  await prisma.usuario.deleteMany()
  console.log('   Banco limpo ✅')
  console.log('')
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('')
  console.log('══════════════════════════════════════════════════════════')
  console.log('  TutoriaAvalia — Seed de Ambiente de Testes')
  console.log('══════════════════════════════════════════════════════════')
  console.log('')

  await limparTudo()

  // ── PROFESSOR ──────────────────────────────────────────────────
  console.log('👤 Criando professor...')
  const tutor = await prisma.usuario.create({
    data: {
      email: 'jackson.lima@prof.cesupa.br',
      nome:  'Jackson Lima',
      papel: Papel.TUTOR,
    },
  })
  console.log(`   ✅ ${tutor.nome} (${tutor.email})`)
  console.log('')

  // ══════════════════════════════════════════════════════════════
  // MÓDULO 1 — Introdução ao Estudo da Medicina
  //   • 3 problemas (P3 = Salto Triplo)
  //   • 10 alunos
  // ══════════════════════════════════════════════════════════════
  console.log('📚 MÓDULO 1 — Introdução ao Estudo da Medicina')
  console.log('   Criando 10 alunos...')

  const turma1Dados = [
    { email: 'med.alice@gmail.com',    nome: 'Alice Ferreira'    },
    { email: 'med.bernardo@gmail.com', nome: 'Bernardo Costa'    },
    { email: 'med.camila@gmail.com',   nome: 'Camila Rodrigues'  },
    { email: 'med.diego@gmail.com',    nome: 'Diego Mendonça'    },
    { email: 'med.elisa@gmail.com',    nome: 'Elisa Tavares'     },
    { email: 'med.fabio@gmail.com',    nome: 'Fábio Nunes'       },
    { email: 'med.giovana@gmail.com',  nome: 'Giovana Pinto'     },
    { email: 'med.heitor@gmail.com',   nome: 'Heitor Cardoso'    },
    { email: 'med.isabela@gmail.com',  nome: 'Isabela Monteiro'  },
    { email: 'med.jonas@gmail.com',    nome: 'Jonas Albuquerque' },
  ]

  const turma1 = await Promise.all(
    turma1Dados.map((a) =>
      prisma.usuario.create({ data: { ...a, papel: Papel.ALUNO } })
    )
  )
  turma1.forEach((a) => console.log(`   ✅ ${a.nome} — ${a.email}`))

  const mod1 = await prisma.modulo.create({
    data: {
      nome:      'Introdução ao Estudo da Medicina',
      ano:        2025,
      tutoria:   'Tutoria 1',
      turma:     'MD1',
      tutorId:    tutor.id,
      ativo:      true,
      arquivado:  false,
    },
  })

  for (let i = 0; i < turma1.length; i++) {
    await prisma.matricula.create({
      data: { moduloId: mod1.id, usuarioId: turma1[i].id, numeraNaTurma: i + 1 },
    })
  }

  const problemasMod1 = [
    {
      numero: 1,
      nome:   'Problema 01 — O Corpo que Conta Histórias',
      aberturaAtiva:    true,
      fechamentoAtivo:  false,
      temSaltoTriplo:   false,
      fechamentoAAtivo: false,
      fechamentoBAtivo: false,
    },
    {
      numero: 2,
      nome:   'Problema 02 — A Linguagem do Sofrimento',
      aberturaAtiva:    false,
      fechamentoAtivo:  false,
      temSaltoTriplo:   false,
      fechamentoAAtivo: false,
      fechamentoBAtivo: false,
    },
    {
      numero: 3,
      nome:   'Problema 03 — Entre Saberes e Cuidados',
      aberturaAtiva:    false,
      fechamentoAtivo:  false,
      temSaltoTriplo:   true,   // ← SALTO TRIPLO: terá FeA e FeB em vez de Fe
      fechamentoAAtivo: false,
      fechamentoBAtivo: false,
    },
  ]

  for (const p of problemasMod1) {
    await prisma.problema.create({ data: { moduloId: mod1.id, ...p } })
  }

  console.log(`   ✅ Módulo criado: ${mod1.nome}`)
  console.log(`   ✅ 10 alunos matriculados`)
  console.log(`   ✅ 3 problemas (P1 com abertura ativa · P3 = Salto Triplo)`)
  console.log('')

  // ══════════════════════════════════════════════════════════════
  // MÓDULO 2 — Ataque e Defesa
  //   • 5 problemas (sem Salto Triplo)
  //   • 8 alunos
  // ══════════════════════════════════════════════════════════════
  console.log('📚 MÓDULO 2 — Ataque e Defesa')
  console.log('   Criando 8 alunos...')

  const turma2Dados = [
    { email: 'imuno.lara@gmail.com',     nome: 'Lara Vieira'     },
    { email: 'imuno.marcos@gmail.com',   nome: 'Marcos Souza'    },
    { email: 'imuno.natalia@gmail.com',  nome: 'Natália Barbosa' },
    { email: 'imuno.otavio@gmail.com',   nome: 'Otávio Lima'     },
    { email: 'imuno.priscila@gmail.com', nome: 'Priscila Araújo' },
    { email: 'imuno.rafael@gmail.com',   nome: 'Rafael Cunha'    },
    { email: 'imuno.sofia@gmail.com',    nome: 'Sofia Carvalho'  },
    { email: 'imuno.thiago@gmail.com',   nome: 'Thiago Martins'  },
  ]

  const turma2 = await Promise.all(
    turma2Dados.map((a) =>
      prisma.usuario.create({ data: { ...a, papel: Papel.ALUNO } })
    )
  )
  turma2.forEach((a) => console.log(`   ✅ ${a.nome} — ${a.email}`))

  const mod2 = await prisma.modulo.create({
    data: {
      nome:      'Ataque e Defesa',
      ano:        2025,
      tutoria:   'Tutoria 2',
      turma:     'MD2',
      tutorId:    tutor.id,
      ativo:      true,
      arquivado:  false,
    },
  })

  for (let i = 0; i < turma2.length; i++) {
    await prisma.matricula.create({
      data: { moduloId: mod2.id, usuarioId: turma2[i].id, numeraNaTurma: i + 1 },
    })
  }

  const problemasMod2 = [
    { numero: 1, nome: 'Problema 01 — Mecanismos de Invasão',        aberturaAtiva: true  },
    { numero: 2, nome: 'Problema 02 — A Resposta Inflamatória',      aberturaAtiva: false },
    { numero: 3, nome: 'Problema 03 — Imunidade Inata',              aberturaAtiva: false },
    { numero: 4, nome: 'Problema 04 — Imunidade Adaptativa',         aberturaAtiva: false },
    { numero: 5, nome: 'Problema 05 — Vacinas e Memória Imunológica', aberturaAtiva: false },
  ]

  for (const p of problemasMod2) {
    await prisma.problema.create({
      data: {
        moduloId: mod2.id,
        ...p,
        fechamentoAtivo:  false,
        temSaltoTriplo:   false,
        fechamentoAAtivo: false,
        fechamentoBAtivo: false,
      },
    })
  }

  console.log(`   ✅ Módulo criado: ${mod2.nome}`)
  console.log(`   ✅ 8 alunos matriculados`)
  console.log(`   ✅ 5 problemas (P1 com abertura ativa · sem Salto Triplo)`)
  console.log('')

  // ── RESUMO FINAL ───────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════')
  console.log('  SEED CONCLUÍDO — AMBIENTE PRONTO PARA TESTES')
  console.log('══════════════════════════════════════════════════════════')
  console.log('')
  console.log('  PROFESSOR')
  console.log(`    Jackson Lima — jackson.lima@prof.cesupa.br`)
  console.log(`    → Entre pelo Google OAuth em http://localhost:3000/login`)
  console.log('')
  console.log('  MÓDULO 1 — Introdução ao Estudo da Medicina (10 alunos)')
  turma1Dados.forEach((a, i) =>
    console.log(`    ${String(i + 1).padStart(2, '0')}. ${a.nome.padEnd(22)} ${a.email}`)
  )
  console.log('')
  console.log('  MÓDULO 2 — Ataque e Defesa (8 alunos)')
  turma2Dados.forEach((a, i) =>
    console.log(`    ${String(i + 1).padStart(2, '0')}. ${a.nome.padEnd(22)} ${a.email}`)
  )
  console.log('')
  console.log('  ACESSO DOS ALUNOS (ambiente de desenvolvimento):')
  console.log('    http://localhost:3000/dev/login')
  console.log('')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
