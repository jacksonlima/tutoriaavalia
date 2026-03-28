/**
 * TutoriaAvalia v2 — Seed Específico
 * Autor: Jackson Lima — CESUPA
 *
 * Módulo: I - Introdução ao Estudo da Medicina
 * Tutoria 5 · MD1 · 2026 · 1º Semestre
 * Tutor: Jackson Lima · 10 alunos · 3 problemas (P3 = Salto Triplo)
 *
 * ESTE SCRIPT:
 *   1. Apaga QUALQUER módulo "Introdução ao Estudo da Medicina" da Tutoria 5 / 2026
 *   2. Recria tudo do zero com os dados corretos
 *   3. NÃO toca nos outros módulos do banco
 *
 * Execução:  npm run db:seed:intro
 */

import { PrismaClient, Papel } from '@prisma/client'
const prisma = new PrismaClient()

const NOME_MODULO = 'I - Introdução ao Estudo da Medicina'
const TUTORIA     = 'Tutoria 5'
const TURMA       = 'MD1'
const ANO         = 2026

const ALUNOS_DATA = [
  { nome: 'Breno Santos Pacheco',         email: 'breno.pacheco@aluno.cesupa.br'     },
  { nome: 'Daniel Rodrigues de Carvalho', email: 'daniel.carvalho@aluno.cesupa.br'   },
  { nome: 'Gabriel Ribeiro Santos',       email: 'gabriel.santos@aluno.cesupa.br'    },
  { nome: 'Isadora Veiga Chaves',         email: 'isadora.chaves@aluno.cesupa.br'    },
  { nome: 'João Pedro da Silva Matos',    email: 'joao.matos@aluno.cesupa.br'        },
  { nome: 'Julia Gomes de Carvalho',      email: 'julia.carvalho@aluno.cesupa.br'    },
  { nome: 'Lucas Moraes Silva',           email: 'lucas.silva@aluno.cesupa.br'       },
  { nome: 'Maria Clara Carneiro Abud',    email: 'maria.abud@aluno.cesupa.br'        },
  { nome: 'Sofia Liz Carvalho Azevedo',   email: 'sofia.azevedo@aluno.cesupa.br'     },
  { nome: 'Yasmim Correa Cavalcante',     email: 'yasmim.cavalcante@aluno.cesupa.br' },
]

const PROBLEMAS_DATA = [
  {
    numero: 1, nome: 'Problema 01 — O Estudante de Medicina',
    aberturaAtiva: true,  fechamentoAtivo:  false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
  {
    numero: 2, nome: 'Problema 02 — O Sistema de Saúde Brasileiro',
    aberturaAtiva: false, fechamentoAtivo:  false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
  {
    numero: 3, nome: 'Problema 03 — A Prática Clínica Supervisionada (ST)',
    aberturaAtiva: false, fechamentoAtivo:  false,
    temSaltoTriplo: true,  fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
]

async function apagarModulosExistentes(tutorId: string) {
  // Busca qualquer variação do nome para esta tutoria/ano/tutor
  const modulos = await prisma.modulo.findMany({
    where: {
      tutorId,
      tutoria: TUTORIA,
      ano:     ANO,
      nome:    { contains: 'Introdução ao Estudo da Medicina' },
    },
    include: { problemas: true },
  })

  if (modulos.length === 0) {
    console.log('   (nenhum módulo anterior encontrado)\n')
    return
  }

  for (const mod of modulos) {
    const probIds = mod.problemas.map((p) => p.id)
    console.log(`   🗑️  Apagando: "${mod.nome}" · ${mod.tutoria} · ${mod.turma} · ${mod.ano}`)

    // Respeita ordem das FKs
    if (probIds.length > 0) {
      await prisma.encontroEspecial.deleteMany({
        where: { OR: [{ moduloOrigemId: mod.id }, { problemaDestinoId: { in: probIds } }] },
      })
      await prisma.coTutorPermissao.deleteMany({ where: { problemaId: { in: probIds } } })
      await prisma.avaliacaoTutor.deleteMany({ where: { problemaId: { in: probIds } } })
      await prisma.avaliacaoAluno.deleteMany({ where: { problemaId: { in: probIds } } })
      await prisma.submissao.deleteMany({ where: { problemaId: { in: probIds } } })
      await prisma.notificacao.deleteMany({ where: { problemaId: { in: probIds } } })
      await prisma.problema.deleteMany({ where: { moduloId: mod.id } })
    }
    await prisma.coTutor.deleteMany({ where: { moduloId: mod.id } })
    await prisma.matricula.deleteMany({ where: { moduloId: mod.id } })
    await prisma.modulo.delete({ where: { id: mod.id } })
    console.log('   ✅ Apagado')
  }
  console.log()
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  TutoriaAvalia — Seed: I - Introdução ao Estudo da Medicina')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── Tutor ────────────────────────────────────────────────────
  console.log('👤 Localizando tutor Jackson Lima...')
  const tutor = await prisma.usuario.upsert({
    where:  { email: 'jackson.lima@prof.cesupa.br' },
    update: { nome: 'Jackson Lima', papel: Papel.TUTOR },
    create: { email: 'jackson.lima@prof.cesupa.br', nome: 'Jackson Lima', papel: Papel.TUTOR },
  })
  console.log(`   ✅ ${tutor.nome}\n`)

  // ── Apaga módulo anterior ────────────────────────────────────
  console.log('🗑️  Verificando módulos anteriores...')
  await apagarModulosExistentes(tutor.id)

  // ── Alunos ───────────────────────────────────────────────────
  console.log('👥 Criando alunos...')
  const alunos = []
  for (const a of ALUNOS_DATA) {
    const aluno = await prisma.usuario.upsert({
      where:  { email: a.email },
      update: { nome: a.nome, papel: Papel.ALUNO },
      create: { email: a.email, nome: a.nome, papel: Papel.ALUNO },
    })
    alunos.push(aluno)
    console.log(`   ✅ ${aluno.nome}`)
  }
  console.log()

  // ── Módulo ───────────────────────────────────────────────────
  console.log('📚 Criando módulo...')
  const modulo = await prisma.modulo.create({
    data: {
      nome:      NOME_MODULO,
      ano:       ANO,
      tutoria:   TUTORIA,
      turma:     TURMA,
      tutorId:   tutor.id,
      ativo:     true,
      arquivado: false,
    },
  })
  console.log(`   ✅ ${modulo.nome} · ${modulo.tutoria} · ${modulo.turma} · ${modulo.ano}\n`)

  // ── Matrículas ───────────────────────────────────────────────
  console.log('📋 Matriculando alunos...')
  for (let i = 0; i < alunos.length; i++) {
    await prisma.matricula.create({
      data: { moduloId: modulo.id, usuarioId: alunos[i].id, numeraNaTurma: i + 1 },
    })
    console.log(`   ✅ ${String(i + 1).padStart(2,'0')}. ${alunos[i].nome}`)
  }
  console.log()

  // ── Problemas ────────────────────────────────────────────────
  console.log('📝 Criando problemas...')
  for (const p of PROBLEMAS_DATA) {
    const prob = await prisma.problema.create({ data: { moduloId: modulo.id, ...p } })
    const st   = prob.temSaltoTriplo ? ' ⚡ Salto Triplo' : ''
    console.log(`   ✅ P${prob.numero} — ${prob.nome}${st}`)
  }
  console.log()

  // ── Resumo ───────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SEED CONCLUÍDO')
  console.log('═══════════════════════════════════════════════════════\n')
  console.log(`  Módulo : ${NOME_MODULO}`)
  console.log(`  Tutoria: ${TUTORIA} · Turma: ${TURMA} · Ano: ${ANO} · 1º Semestre`)
  console.log(`  Tutor  : Jackson Lima (jackson.lima@prof.cesupa.br)\n`)
  console.log('  Problemas:')
  console.log('  P1 — O Estudante de Medicina            [Abertura ATIVA]')
  console.log('  P2 — O Sistema de Saúde Brasileiro      [Inativo]')
  console.log('  P3 — A Prática Clínica Supervisionada   [Salto Triplo, inativo]\n')
  console.log('  Alunos (10):')
  for (const a of ALUNOS_DATA) {
    console.log(`  · ${a.nome.padEnd(36)} ${a.email}`)
  }
  console.log()
  console.log('  Login de desenvolvimento:')
  console.log('  → http://localhost:3000/dev/login')
  console.log('  → Tutor : jackson.lima@prof.cesupa.br')
  console.log('  → Aluno : breno.pacheco@aluno.cesupa.br\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
