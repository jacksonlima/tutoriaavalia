import React from 'react'
import Link  from 'next/link'
import { auth }     from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TopBar }   from '@/components/ui/TopBar'
import { calcMMenosAtTutor, calcMMenosAtAluno, calcNotaEncontro, arredondar, fmt2 } from '@/lib/notas'

export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<{ moduloId?: string }> }

export default async function RelatoriosPage({ searchParams }: Props) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') redirect('/login')

  const params   = await searchParams
  const moduloId = params.moduloId
  if (!moduloId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-gray-400">Selecione um módulo no painel para ver o relatório.</p>
        </main>
      </div>
    )
  }

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
  if (!modulo) redirect('/professor/dashboard')

  if (modulo.tutorId !== session?.user?.id) {
    const permissao = await prisma.coTutorPermissao.findFirst({
      where: { moduloId, tutorId: session?.user?.id },
    })
    if (!permissao) redirect('/professor/dashboard')
  }

  // ── Avaliações regulares (alunos do próprio módulo) ──────────────────────
  const [avaliacoesTutor, avaliacoesAluno] = await Promise.all([
    prisma.avaliacaoTutor.findMany({ where: { problema: { moduloId } } }),
    prisma.avaliacaoAluno.findMany({ where: { problema: { moduloId } } }),
  ])

  // ── Situações Excepcionais: alunos deste módulo que foram visitantes ──────
  // Inclui problemaDestino.numero para correspondência com coluna do relatório
  const situacoesExcepcionais = await prisma.situacaoExcepcional.findMany({
    where:   { moduloOrigemId: moduloId },
    include: { problemaDestino: { select: { id: true, numero: true } } },
  })

  // IDs únicos dos problemas destino (de outros módulos)
  const destProblemaIds = [...new Set(situacoesExcepcionais.map((s) => s.problemaDestinoId))]

  // Avaliações externas (nos módulos destino) para os alunos visitantes
  const [avaliacoesTutorExt, avaliacoesAlunoExt] =
    destProblemaIds.length > 0
      ? await Promise.all([
          prisma.avaliacaoTutor.findMany({ where: { problemaId: { in: destProblemaIds } } }),
          prisma.avaliacaoAluno.findMany({ where: { problemaId: { in: destProblemaIds } } }),
        ])
      : [[], []]

  // Mescla avaliações locais + externas para facilitar lookup
  const todasAvaliacoesTutor = [...avaliacoesTutor, ...avaliacoesTutorExt]
  const todasAvaliacoesAluno = [...avaliacoesAluno, ...avaliacoesAlunoExt]

  // ── Helper: resolve problemaId efetivo para aluno/tipo ───────────────────
  // Se há SE para este aluno neste tipo de encontro cujo problema destino
  // tem o mesmo número que o problema atual → usa o problema destino
  function resolverProbId(probId: string, probNumero: number, alunoId: string, tipo: string): string {
    const se = situacoesExcepcionais.find(
      (s) =>
        s.alunoId === alunoId &&
        s.tipoEncontro === tipo &&
        s.problemaDestino.numero === probNumero,
    )
    return se ? se.problemaDestinoId : probId
  }

  // ── Cálculo de nota por problema/aluno/tipo ───────────────────────────────
  const calcNota = (probId: string, probNumero: number, alunoId: string, tipo: string) => {
    const efetivoProbId = resolverProbId(probId, probNumero, alunoId, tipo)

    const avT = todasAvaliacoesTutor.find(
      (a) => a.problemaId === efetivoProbId && a.avaliadoId === alunoId && a.tipoEncontro === tipo,
    )
    if (!avT) return null

    const notaTutor = calcMMenosAtTutor(
      Number(avT.c1), Number(avT.c2), Number(avT.c3),
      Number(avT.atitudes),
      avT.ativCompensatoria,
    )

    const avSelf = todasAvaliacoesAluno.find(
      (a) =>
        a.problemaId === efetivoProbId &&
        a.avaliadorId === alunoId &&
        a.avaliadoId === alunoId &&
        a.tipoEncontro === tipo,
    )
    const notaSelf = avSelf
      ? calcMMenosAtAluno(Number(avSelf.c1), Number(avSelf.c2), Number(avSelf.c3), Number(avSelf.atitudes))
      : null

    const pares = todasAvaliacoesAluno.filter(
      (a) =>
        a.problemaId === efetivoProbId &&
        a.avaliadoId === alunoId &&
        a.avaliadorId !== alunoId &&
        a.tipoEncontro === tipo,
    )
    const mi =
      pares.length > 0
        ? pares.reduce(
            (acc, a) =>
              acc + calcMMenosAtAluno(Number(a.c1), Number(a.c2), Number(a.c3), Number(a.atitudes)),
            0,
          ) / pares.length
        : null

    const nota = calcNotaEncontro({ notaTutor, mediaInterpares: mi, notaAutoAvaliacao: notaSelf })
    if (nota === null) return null
    if (nota === 'SATISFATORIO') return 'SATISFATORIO'
    return arredondar(nota as number)
  }

  // ── Indica se aluno foi visitante em algum encontro (para ícone na tabela) ─
  const alunosComSE = new Set(situacoesExcepcionais.map((s) => s.alunoId))

  const resumo = modulo.matriculas.map((mat) => {
    const aluno   = mat.usuario
    const notasAb: number[] = []
    const notasFe: number[] = []
    const notas:   Record<number, any> = {}

    for (const prob of modulo.problemas) {
      const ab = calcNota(prob.id, prob.numero, aluno.id, 'ABERTURA')
      if (typeof ab === 'number') notasAb.push(ab)

      if (prob.temSaltoTriplo) {
        const fa = calcNota(prob.id, prob.numero, aluno.id, 'FECHAMENTO_A')
        const fb = calcNota(prob.id, prob.numero, aluno.id, 'FECHAMENTO_B')
        if (typeof fa === 'number') notasFe.push(fa)
        if (typeof fb === 'number') notasFe.push(fb)
        notas[prob.numero] = { ab, fa, fb, st: true }
      } else {
        const fe = calcNota(prob.id, prob.numero, aluno.id, 'FECHAMENTO')
        if (typeof fe === 'number') notasFe.push(fe)
        notas[prob.numero] = { ab, fe, st: false }
      }
    }

    const mediaAb    = notasAb.length > 0 ? arredondar(notasAb.reduce((a, b) => a + b, 0) / notasAb.length) : null
    const mediaFe    = notasFe.length > 0 ? arredondar(notasFe.reduce((a, b) => a + b, 0) / notasFe.length) : null
    const notaFinal  = mediaAb !== null && mediaFe !== null ? arredondar(Math.min(mediaAb + mediaFe, 10)) : null
    const temSE      = alunosComSE.has(aluno.id)

    return { aluno, notas, mediaAb, mediaFe, notaFinal, temSE }
  })

  const d = (v: any) => fmt2(v)

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1F4E79]">Resumo MT — {modulo.nome}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{modulo.tutoria} - Turma {modulo.turma} - {modulo.ano}</p>
          </div>
          <Link
            href={`/professor/relatorios/exportar?moduloId=${moduloId}`}
            target="_blank"
            className="flex items-center gap-2 bg-[#1F4E79] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#163d61] transition-colors whitespace-nowrap"
          >
            🖨️ Exportar / Imprimir
          </Link>
        </div>

        {/* Banner de SE presente no módulo */}
        {situacoesExcepcionais.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <span className="text-purple-500 text-lg">🔄</span>
            <p className="text-xs text-purple-700">
              <span className="font-bold">Situações Excepcionais:</span>{' '}
              {alunosComSE.size} {alunosComSE.size === 1 ? 'aluno participou' : 'alunos participaram'} como visitante(s)
              em outra tutoria. As notas são calculadas a partir da avaliação recebida no grupo visitado.
              <span className="ml-1 font-bold">🔄</span> indica esses alunos.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-[#1F4E79] text-white">
                  <th className="text-left px-4 py-3 font-medium sticky left-0 bg-[#1F4E79]">Aluno</th>
                  {modulo.problemas.map((p) => (
                    <th key={p.id} colSpan={p.temSaltoTriplo ? 3 : 2}
                      className="px-2 py-3 font-medium text-center border-l border-blue-800">
                      P{p.numero}{p.temSaltoTriplo ? ' ST' : ''}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium border-l border-blue-800">M.Ab</th>
                  <th className="px-3 py-3 font-medium">M.Fe</th>
                  <th className="px-3 py-3 font-medium bg-blue-900">Nota</th>
                </tr>
                <tr className="bg-[#2E75B6] text-white text-center text-xs">
                  <th className="sticky left-0 bg-[#2E75B6]" />
                  {modulo.problemas.map((p) =>
                    p.temSaltoTriplo ? (
                      <React.Fragment key={p.id + 'header'}>
                        <th className="px-2 py-1 opacity-80 border-l border-blue-700">Ab</th>
                        <th className="px-2 py-1 opacity-80">FeA</th>
                        <th className="px-2 py-1 opacity-80">FeB</th>
                      </React.Fragment>
                    ) : (
                      <React.Fragment key={p.id + 'header'}>
                        <th className="px-2 py-1 opacity-80 border-l border-blue-700">Ab</th>
                        <th className="px-2 py-1 opacity-80">Fe</th>
                      </React.Fragment>
                    ),
                  )}
                  <th /><th /><th />
                </tr>
              </thead>
              <tbody>
                {resumo.map((linha, idx) => (
                  <tr key={linha.aluno.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2.5 font-medium text-gray-800 sticky left-0 bg-inherit">
                      <div className="flex items-center gap-1.5">
                        {linha.aluno.nome}
                        {linha.temSE && (
                          <span title="Participou como visitante em outra tutoria" className="text-purple-500 cursor-help">🔄</span>
                        )}
                      </div>
                    </td>
                    {modulo.problemas.map((p) => {
                      const n = linha.notas[p.numero]
                      const celula = (val: any, borda?: boolean) => {
                        const txt   = d(val)
                        const isSat = txt === 'SATISFATÓRIO'
                        return (
                          <td className={
                            'px-2 py-2 text-center text-xs ' +
                            (borda ? 'border-l border-gray-100 ' : '') +
                            (isSat ? 'text-green-700 font-semibold bg-green-50' : '')
                          }>
                            {txt}
                          </td>
                        )
                      }
                      return n?.st ? (
                        <React.Fragment key={p.id + 'cell'}>
                          {celula(n.ab, true)}
                          {celula(n.fa)}
                          {celula(n.fb)}
                        </React.Fragment>
                      ) : (
                        <React.Fragment key={p.id + 'cell'}>
                          {celula(n?.ab, true)}
                          {celula(n?.fe)}
                        </React.Fragment>
                      )
                    })}
                    <td className="px-3 py-2 text-center font-semibold border-l border-gray-100">{d(linha.mediaAb)}</td>
                    <td className="px-3 py-2 text-center font-semibold">{d(linha.mediaFe)}</td>
                    <td className="px-3 py-2 text-center font-bold text-[#1F4E79] text-sm">{d(linha.notaFinal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">
          Nota = Média Ab + Média Fe (máx 10) · ST = Salto Triplo · SATISFATÓRIO = Atividade Compensatória (excluído das médias) ·
          🔄 = Situação Excepcional (nota do grupo visitado) · — = sem dados
        </p>
      </main>
    </div>
  )
}
