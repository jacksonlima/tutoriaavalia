/**
 * TutoriaAvalia v2 — Seed Específico
 * Autor: Jackson Lima — CESUPA
 *
 * Módulo: III - Ataque e Defesa
 * Tutoria 2 · MD2 · 2025 · 2º Semestre
 * Tutor: Jackson Lima · 8 alunos · 5 problemas (sem Salto Triplo)
 *
 * ESTE SCRIPT É ADITIVO:
 *   1. Apaga o módulo "Ataque e Defesa" da Tutoria 2 / 2025 (se existir)
 *   2. Recria tudo do zero com os dados abaixo
 *   3. NÃO toca nos outros módulos do banco
 *
 * Execução:  npm run db:seed:ataque
 */

import { PrismaClient, Papel } from '@prisma/client'
const prisma = new PrismaClient()

const NOME_MODULO = 'III - Ataque e Defesa'
const TUTORIA     = 'Tutoria 2'
const TURMA       = 'MD2'
const ANO         = 2025

const ALUNOS_DATA = [
  { nome: 'Amanda Oliveira Teixeira',         email: 'amanda.teixeira@aluno.cesupa.br'    },
  { nome: 'Beatriz Chyang Tam Leão',          email: 'beatriz.leao@aluno.cesupa.br'       },
  { nome: 'Felipe Sotão Vieitas Spinelli',    email: 'felipe.spinelli@aluno.cesupa.br'    },
  { nome: 'Larissa Elita Nunes de Aragão',    email: 'larissa.aragao@aluno.cesupa.br'     },
  { nome: 'Lucas Marinho Garcia Costa',       email: 'lucas.garcia@aluno.cesupa.br'       },
  { nome: 'Maria Luiza Silva de Souza',       email: 'maria.souza@aluno.cesupa.br'        },
  { nome: 'Mateus Ian do Vale Guimarães',     email: 'mateus.guimaraes@aluno.cesupa.br'   },
  { nome: 'Yasmin Fernandes da Fonseca',      email: 'yasmin.fonseca@aluno.cesupa.br'     },
]

const PROBLEMAS_DATA = [
  {
    numero: 1, nome: 'Problema 01 — Resposta Imune Inata',
    aberturaAtiva: true,  fechamentoAtivo: false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
  {
    numero: 2, nome: 'Problema 02 — Resposta Imune Adaptativa',
    aberturaAtiva: false, fechamentoAtivo: false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
  {
    numero: 3, nome: 'Problema 03 — Inflamação e Febre',
    aberturaAtiva: false, fechamentoAtivo: false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
  {
    numero: 4, nome: 'Problema 04 — Hipersensibilidade e Autoimunidade',
    aberturaAtiva: false, fechamentoAtivo: false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
  {
    numero: 5, nome: 'Problema 05 — Imunodeficiências e Vacinas',
    aberturaAtiva: false, fechamentoAtivo: false,
    temSaltoTriplo: false, fechamentoAAtivo: false, fechamentoBAtivo: false,
  },
]

async function apagarModuloExistente(tutorId: string) {
  const modulos = await prisma.modulo.findMany({
    where: {
      tutorId,
      tutoria: TUTORIA,
      ano:     ANO,
      nome:    { contains: 'Ataque e Defesa' },
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
  console.log('  TutoriaAvalia — Seed: III - Ataque e Defesa')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── Tutor ────────────────────────────────────────────────────
  console.log('👤 Localizando tutor Jackson Lima...')
  const tutor = await prisma.usuario.upsert({
    where:  { email: 'jackson.lima@prof.cesupa.br' },
    update: { nome: 'Jackson Lima', papel: Papel.TUTOR },
    create: { email: 'jackson.lima@prof.cesupa.br', nome: 'Jackson Lima', papel: Papel.TUTOR },
  })
  console.log(`   ✅ ${tutor.nome}\n`)

  // ── Apaga módulo anterior se existir ─────────────────────────
  console.log('🗑️  Verificando módulos anteriores...')
  await apagarModuloExistente(tutor.id)

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
  console.log(`   ✅ ${modulo.nome} · ${modulo.tutoria} · ${modulo.turma} · ${modulo.ano} · 2º Semestre\n`)

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
    const status = prob.aberturaAtiva ? '[Abertura ATIVA]' : '[Inativo]'
    console.log(`   ✅ P${prob.numero} — ${prob.nome} ${status}`)
  }
  console.log()

  // ── Resumo ───────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SEED CONCLUÍDO')
  console.log('═══════════════════════════════════════════════════════\n')
  console.log(`  Módulo : ${NOME_MODULO}`)
  console.log(`  Tutoria: ${TUTORIA} · Turma: ${TURMA} · Ano: ${ANO} · 2º Semestre`)
  console.log(`  Tutor  : Jackson Lima (jackson.lima@prof.cesupa.br)\n`)
  console.log('  Problemas (5, sem Salto Triplo):')
  for (const p of PROBLEMAS_DATA) {
    const status = p.aberturaAtiva ? ' ← Abertura já ATIVA para teste' : ''
    console.log(`  P${p.numero} — ${p.nome}${status}`)
  }
  console.log()
  console.log('  Alunos (8):')
  for (const a of ALUNOS_DATA) {
    console.log(`  · ${a.nome.padEnd(38)} ${a.email}`)
  }
  console.log()
  console.log('  LOGIN DE DESENVOLVIMENTO:')
  console.log('  → http://localhost:3000/dev/login  (ou :8080 no celular)')
  console.log('  → Tutor : jackson.lima@prof.cesupa.br')
  console.log('  → Aluno : amanda.teixeira@aluno.cesupa.br\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
