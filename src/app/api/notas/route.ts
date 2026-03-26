import { auth } from '@/lib/auth'
import { calcMMenosAtTutor, calcMMenosAtAluno, calcNotaEncontro, arredondar } from '@/lib/notas'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const moduloId = searchParams.get('moduloId')
  if (!moduloId) return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    include: {
      matriculas: {
        include: { usuario: { select: { id: true, nome: true } } },
        orderBy:  { numeraNaTurma: 'asc' },
      },
      problemas: { orderBy: { numero: 'asc' } },
    },
  })
  // Verifica se é titular ou co-tutor
  if (!modulo) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }
  if (modulo.tutorId !== session.user.id) {
    const { prisma: p2 } = await import('@/lib/db')
    const coTutor = await p2.coTutor.findUnique({
      where: { moduloId_tutorId: { moduloId, tutorId: session.user.id } },
    })
    if (!coTutor) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  // Avaliações do próprio módulo
  const [avaliacoesTutor, avaliacoesAluno] = await Promise.all([
    prisma.avaliacaoTutor.findMany({ where: { problema: { moduloId } } }),
    prisma.avaliacaoAluno.findMany({ where: { problema: { moduloId } } }),
  ])

  // Avaliações externas via encontros especiais (alunos redistribuídos)
  const encontrosEspeciais = await prisma.encontroEspecial.findMany({
    where:   { moduloOrigemId: moduloId },
    select:  { alunoId: true, problemaDestinoId: true, tipoEncontro: true },
  })

  const problemasDestinoIds = [...new Set(encontrosEspeciais.map((e) => e.problemaDestinoId))]
  const [avTutorExt, avAlunoExt] = problemasDestinoIds.length > 0
    ? await Promise.all([
        prisma.avaliacaoTutor.findMany({ where: { problemaId: { in: problemasDestinoIds } } }),
        prisma.avaliacaoAluno.findMany({ where: { problemaId: { in: problemasDestinoIds } } }),
      ])
    : [[], []]

  // Calcula nota de um encontro qualquer (interno ou externo)
  const calcNotaParaProblema = (
    problemaId:       string,
    alunoId:          string,
    tipo:             string,
    tutorAvals:       typeof avaliacoesTutor,
    alunoAvals:       typeof avaliacoesAluno,
  ): number | 'SATISFATORIO' | null => {
    const avTutor = tutorAvals.find(
      (a) => a.problemaId === problemaId && a.avaliadoId === alunoId && a.tipoEncontro === tipo
    )
    if (!avTutor) return null

    const notaTutor = calcMMenosAtTutor(
      Number(avTutor.c1), Number(avTutor.c2), Number(avTutor.c3),
      Number(avTutor.atitudes), avTutor.ativCompensatoria
    )

    const avSelf = alunoAvals.find(
      (a) => a.problemaId === problemaId && a.avaliadorId === alunoId
          && a.avaliadoId === alunoId && a.tipoEncontro === tipo
    )
    const notaSelf = avSelf
      ? calcMMenosAtAluno(Number(avSelf.c1), Number(avSelf.c2), Number(avSelf.c3), Number(avSelf.atitudes))
      : null

    const avPares = alunoAvals.filter(
      (a) => a.problemaId === problemaId && a.avaliadoId === alunoId
          && a.avaliadorId !== alunoId && a.tipoEncontro === tipo
    )
    const mediaInterpares = avPares.length > 0
      ? avPares.reduce((acc, a) => acc + calcMMenosAtAluno(Number(a.c1), Number(a.c2), Number(a.c3), Number(a.atitudes)), 0) / avPares.length
      : null

    const nota = calcNotaEncontro({ notaTutor, mediaInterpares, notaAutoAvaliacao: notaSelf })
    if (nota === null)          return null
    if (nota === 'SATISFATORIO') return 'SATISFATORIO'
    return arredondar(nota)
  }

  // Wrapper: busca primeiro no módulo local, depois em encontros especiais
  const calcNotaParaTipo = (
    problemaId: string,
    alunoId:    string,
    tipo:       string
  ): number | 'SATISFATORIO' | null => {
    // Nota interna (problema do próprio módulo)
    const notaInterna = calcNotaParaProblema(problemaId, alunoId, tipo, avaliacoesTutor, avaliacoesAluno)
    if (notaInterna !== null) return notaInterna
    // Nota externa (aluno foi redistribuído para outro módulo neste tipo de encontro)
    const ee = encontrosEspeciais.find(
      (e) => e.alunoId === alunoId && e.tipoEncontro === tipo
      // Nota: para encontros especiais, qualquer problema externo com aquele tipo conta
    )
    if (!ee) return null
    return calcNotaParaProblema(ee.problemaDestinoId, alunoId, tipo, avTutorExt as any, avAlunoExt as any)
  }

  const fmt = (v: any) => v === null ? null : v === 'SATISFATORIO' ? 'SAT' : v

  const resumo = modulo.matriculas.map((matricula) => {
    const aluno = matricula.usuario
    const notasPorProblema: Record<string, any> = {}

    for (const prob of modulo.problemas) {
      if (prob.temSaltoTriplo) {
        // Salto Triplo: 1 abertura + 2 fechamentos
        notasPorProblema[prob.numero] = {
          ABERTURA:    fmt(calcNotaParaTipo(prob.id, aluno.id, 'ABERTURA')),
          FECHAMENTO_A: fmt(calcNotaParaTipo(prob.id, aluno.id, 'FECHAMENTO_A')),
          FECHAMENTO_B: fmt(calcNotaParaTipo(prob.id, aluno.id, 'FECHAMENTO_B')),
          temSaltoTriplo: true,
        }
      } else {
        notasPorProblema[prob.numero] = {
          ABERTURA:   fmt(calcNotaParaTipo(prob.id, aluno.id, 'ABERTURA')),
          FECHAMENTO: fmt(calcNotaParaTipo(prob.id, aluno.id, 'FECHAMENTO')),
          temSaltoTriplo: false,
        }
      }
    }

    // Calcular medias
    const notasAb: number[] = []
    const notasFe: number[] = []

    for (const prob of modulo.problemas) {
      const np = notasPorProblema[prob.numero]
      const ab = np.ABERTURA
      if (typeof ab === 'number') notasAb.push(ab)

      if (prob.temSaltoTriplo) {
        // Ambos fechamentos A e B entram na media de fechamentos
        const fa = np.FECHAMENTO_A
        const fb = np.FECHAMENTO_B
        if (typeof fa === 'number') notasFe.push(fa)
        if (typeof fb === 'number') notasFe.push(fb)
      } else {
        const fe = np.FECHAMENTO
        if (typeof fe === 'number') notasFe.push(fe)
      }
    }

    const mediaAb = notasAb.length > 0
      ? arredondar(notasAb.reduce((a, b) => a + b, 0) / notasAb.length) : null
    const mediaFe = notasFe.length > 0
      ? arredondar(notasFe.reduce((a, b) => a + b, 0) / notasFe.length) : null
    const notaFormativa = mediaAb !== null && mediaFe !== null
      ? arredondar(Math.min(mediaAb + mediaFe, 10)) : null

    return { aluno, notasPorProblema, mediaAb, mediaFe, notaFormativa }
  })

  return NextResponse.json({
    modulo:   { id: modulo.id, nome: modulo.nome, turma: modulo.turma, tutoria: modulo.tutoria },
    problemas: modulo.problemas,
    resumo,
  })
}
