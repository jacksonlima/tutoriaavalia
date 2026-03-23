import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcMMenosAtTutor, calcMMenosAtAluno, calcNotaEncontro, arredondar } from '@/lib/notas'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const moduloId = searchParams.get('moduloId')
  if (!moduloId) return NextResponse.json({ error: 'moduloId obrigatorio' }, { status: 400 })

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
  if (!modulo || modulo.tutorId !== session.user.id) {
    return NextResponse.json({ error: 'Modulo nao encontrado' }, { status: 404 })
  }

  const [avaliacoesTutor, avaliacoesAluno] = await Promise.all([
    prisma.avaliacaoTutor.findMany({ where: { problema: { moduloId } } }),
    prisma.avaliacaoAluno.findMany({ where: { problema: { moduloId } } }),
  ])

  // Para cada problema, quais tipos de encontro existem
  // Problema normal: ABERTURA, FECHAMENTO
  // Problema com Salto Triplo: ABERTURA, FECHAMENTO_A, FECHAMENTO_B
  const calcNotaParaTipo = (
    problemaId: string,
    alunoId:    string,
    tipo:       string
  ): number | 'SATISFATORIO' | null => {
    const avTutor = avaliacoesTutor.find(
      (a) => a.problemaId === problemaId && a.avaliadoId === alunoId && a.tipoEncontro === tipo
    )
    // Basta a avaliação existir — finalizado foi descontinuado
    if (!avTutor) return null

    const notaTutor = calcMMenosAtTutor(
      Number(avTutor.c1), Number(avTutor.c2), Number(avTutor.c3),
      Number(avTutor.atitudes), avTutor.ativCompensatoria
    )

    const avSelf = avaliacoesAluno.find(
      (a) => a.problemaId === problemaId && a.avaliadorId === alunoId
          && a.avaliadoId === alunoId && a.tipoEncontro === tipo
    )
    const notaSelf = avSelf
      ? calcMMenosAtAluno(Number(avSelf.c1), Number(avSelf.c2), Number(avSelf.c3), Number(avSelf.atitudes))
      : null

    const avPares = avaliacoesAluno.filter(
      (a) => a.problemaId === problemaId && a.avaliadoId === alunoId
          && a.avaliadorId !== alunoId && a.tipoEncontro === tipo
    )
    let mediaInterpares: number | null = null
    if (avPares.length > 0) {
      mediaInterpares = avPares.reduce(
        (acc, a) => acc + calcMMenosAtAluno(Number(a.c1), Number(a.c2), Number(a.c3), Number(a.atitudes)), 0
      ) / avPares.length
    }

    const nota = calcNotaEncontro({ notaTutor, mediaInterpares, notaAutoAvaliacao: notaSelf })
    if (nota === null)          return null
    if (nota === 'SATISFATORIO') return 'SATISFATORIO'
    return arredondar(nota)
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
