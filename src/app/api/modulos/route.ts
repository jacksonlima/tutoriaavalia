/**
 * TutoriaAvalia v2 — API: Módulos (v2)
 * Autor: Jackson Lima — CESUPA
 *
 * Correção de segurança:
 *   Para co-tutores, cada problema retorna apenas os encontros que ele
 *   tem permissão (via CoTutorPermissao). O frontend usa essa informação
 *   para filtrar o que exibir e o que pode ser toggleado.
 */
import { auth }              from '@/lib/auth'
import { criarModuloSchema } from '@/lib/validations'
import { Papel }             from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (session?.user?.papel === 'TUTOR') {
    const userId = session?.user?.id!

    // Busca permissões de co-tutor do usuário
    const coTutorPerms = await prisma.coTutorPermissao.findMany({
      where:  { tutorId: userId },
      select: { moduloId: true, problemaId: true, tipoEncontro: true },
    })

    // IDs únicos de módulos onde é co-tutor
    const coTutorModuloIds = [...new Set(coTutorPerms.map((p: any) => p.moduloId))]

    // Monta mapa: moduloId → Set de "problemaId|tipoEncontro"
    const permMap = new Map<string, Set<string>>()
    for (const p of coTutorPerms) {
      if (!permMap.has(p.moduloId)) permMap.set(p.moduloId, new Set())
      permMap.get(p.moduloId)!.add(`${p.problemaId}|${p.tipoEncontro}`)
    }

    const modulos = await prisma.modulo.findMany({
      where: {
        arquivado: false,
        OR: [
          { tutorId: userId },
          { id: { in: coTutorModuloIds } },
        ],
      },
      include: {
        tutor:      { select: { nome: true } },
        problemas:  { orderBy: { numero: 'asc' } },
        matriculas: {
          include: { usuario: { select: { id: true, nome: true, email: true } } },
          orderBy: { numeraNaTurma: 'asc' },
        },
        _count: { select: { matriculas: true } },
      },
      orderBy: { criadoEm: 'desc' },
    })

    // Para módulos onde é co-tutor: adiciona metadado de permissão por problema
    const modulosComPerms = modulos.map((m: any) => {
      const eTitular = m.tutorId === userId
      if (eTitular) return { ...m, eTitular: true, permissoesCoTutor: null }

      // É co-tutor neste módulo: filtra problemas e marca encontros permitidos
      const permsDoModulo = permMap.get(m.id) ?? new Set()

      // Conjunto de problemaIds que tem ao menos uma permissão
      const problemasPermitidosIds = new Set(
        [...permsDoModulo].map(k => k.split('|')[0])
      )

      const problemasFiltrados = m.problemas
        .filter((p: any) => problemasPermitidosIds.has(p.id))
        .map((p: any) => ({
          ...p,
          // Marca quais encontros estão liberados para este co-tutor
          _permissoesCoTutor: {
            abertura:    permsDoModulo.has(`${p.id}|ABERTURA`),
            fechamento:  permsDoModulo.has(`${p.id}|FECHAMENTO`),
            fechamentoA: permsDoModulo.has(`${p.id}|FECHAMENTO_A`),
            fechamentoB: permsDoModulo.has(`${p.id}|FECHAMENTO_B`),
          },
        }))

      return {
        ...m,
        eTitular: false,
        problemas: problemasFiltrados,
        permissoesCoTutor: [...permsDoModulo],
      }
    })

    return NextResponse.json(modulosComPerms)
  }

  // ── ALUNO ─────────────────────────────────────────────────────────────────
  const matriculas = await prisma.matricula.findMany({
    where: { usuarioId: session?.user?.id },
    include: {
      modulo: {
        include: {
          tutor:      { select: { nome: true } },
          problemas:  { orderBy: { numero: 'asc' } },
          matriculas: {
            include: { usuario: { select: { id: true, nome: true } } },
            orderBy: { numeraNaTurma: 'asc' },
          },
        },
      },
    },
  })

  return NextResponse.json(matriculas.map((m: any) => m.modulo))
}

export async function POST(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body   = await req.json()
  const result = criarModuloSchema.safeParse(body)
  if (!result.success)
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { nome, ano, tutoria, turma, semestre, alunos } = result.data

  const erros: string[] = []
  const matriculas: { email: string; nome: string }[] = []

  for (const email of (alunos ?? [])) {
    const emailLower = email.toLowerCase().trim()
    const usuario = await prisma.usuario.findUnique({ where: { email: emailLower } })
    if (!usuario) { erros.push(`Aluno não encontrado: ${email}`); continue }
    if (usuario.papel !== 'ALUNO') { erros.push(`${email} não é um aluno`); continue }
    matriculas.push({ email: emailLower, nome: usuario.nome })
  }

  if (erros.length > 0)
    return NextResponse.json({ error: erros.join('; ') }, { status: 400 })

  const modulo = await prisma.$transaction(async (tx: any) => {
    const novoModulo = await tx.modulo.create({
      data: {
        nome, ano, tutoria, turma,
        semestre: semestre ?? '01º Semestre',
        tutorId: session?.user?.id!,
      },
    })

    for (let i = 0; i < matriculas.length; i++) {
      const usuario = await tx.usuario.findUnique({
        where: { email: matriculas[i].email },
      })
      if (usuario) {
        await tx.matricula.create({
          data: { moduloId: novoModulo.id, usuarioId: usuario.id, numeraNaTurma: i + 1 },
        })
      }
    }

    return tx.modulo.findUnique({
      where: { id: novoModulo.id },
      include: {
        problemas:  { orderBy: { numero: 'asc' } },
        matriculas: { include: { usuario: { select: { id: true, nome: true, email: true } } } },
      },
    })
  })

  return NextResponse.json(modulo, { status: 201 })
}
