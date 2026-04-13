/**
 * TutoriaAvalia v2 — Exportação PDF / Impressão do Módulo
 * Autor: Jackson Lima — CESUPA
 *
 * Página otimizada para impressão e exportação em PDF.
 * Acesso: /professor/relatorios/exportar?moduloId=X
 *
 * Estrutura do relatório:
 *   1. Capa — identificação do módulo
 *   2. Resumo MT — tabela geral com nota formativa de cada aluno
 *   3. Detalhe por Encontro — uma seção por Problema × Tipo, mostrando:
 *      - Nota do Tutor (C1, C2, C3, Atit, M-At, Faltou/Comp)
 *      - Auto-avaliação (C1, C2, C3, Atit, M-At)
 *      - Interpares (notas que cada colega atribuiu)
 *      - Nota Final calculada
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
  calcMMenosAtTutor,
  calcMMenosAtAluno,
  calcNotaEncontro,
  arredondar,
  fmt2,
} from '@/lib/notas'
import { getCriterios, getLabelTipo } from '@/lib/criterios'

export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<{ moduloId?: string }> }

// ── Helpers ─────────────────────────────────────────────────────────────────

function n(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(2)
}

function cls(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export default async function ExportarRelatorio({ searchParams }: Props) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') redirect('/login')

  const params   = await searchParams
  const moduloId = params.moduloId
  if (!moduloId) redirect('/professor/dashboard')

  // ── Busca dados ───────────────────────────────────────────────
  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    include: {
      tutor:     { select: { nome: true } },
      matriculas: {
        include: { usuario: { select: { id: true, nome: true } } },
        orderBy:  { numeraNaTurma: 'asc' },
      },
      problemas: { orderBy: { numero: 'asc' } },
    },
  })
  if (!modulo) redirect('/professor/dashboard')

  if (modulo.tutorId !== session.user.id) {
    const coTutor = await prisma.coTutor.findUnique({
      where: { moduloId_tutorId: { moduloId, tutorId: session.user.id } },
    })
    if (!coTutor) redirect('/professor/dashboard')
  }

  const [avaliacoesTutor, avaliacoesAluno] = await Promise.all([
    prisma.avaliacaoTutor.findMany({ where: { problema: { moduloId } } }),
    prisma.avaliacaoAluno.findMany({ where: { problema: { moduloId } } }),
  ])

  const alunos  = modulo.matriculas.map((m) => m.usuario)
  const hoje    = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Cálculo de nota por aluno/problema/tipo ───────────────────
  function calcNota(problemaId: string, alunoId: string, tipo: string) {
    const avT = avaliacoesTutor.find(
      (a) => a.problemaId === problemaId && a.avaliadoId === alunoId && a.tipoEncontro === tipo
    )
    if (!avT) return null

    const notaTutor = calcMMenosAtTutor(
      Number(avT.c1), Number(avT.c2), Number(avT.c3),
      Number(avT.atitudes), avT.ativCompensatoria
    )

    const avSelf = avaliacoesAluno.find(
      (a) => a.problemaId === problemaId && a.avaliadorId === alunoId
          && a.avaliadoId === alunoId && a.tipoEncontro === tipo
    )
    const notaSelf = avSelf
      ? calcMMenosAtAluno(Number(avSelf.c1), Number(avSelf.c2), Number(avSelf.c3), Number(avSelf.atitudes))
      : null

    const pares = avaliacoesAluno.filter(
      (a) => a.problemaId === problemaId && a.avaliadoId === alunoId
          && a.avaliadorId !== alunoId && a.tipoEncontro === tipo
    )
    const mi = pares.length > 0
      ? pares.reduce((acc, a) =>
          acc + calcMMenosAtAluno(Number(a.c1), Number(a.c2), Number(a.c3), Number(a.atitudes)), 0
        ) / pares.length
      : null

    const nota = calcNotaEncontro({ notaTutor, mediaInterpares: mi, notaAutoAvaliacao: notaSelf })
    if (nota === null)           return null
    if (nota === 'SATISFATORIO') return 'SATISFATORIO' as const
    return arredondar(nota)
  }

  // ── Resumo MT ────────────────────────────────────────────────
  const resumo = alunos.map((aluno) => {
    const notasAb: number[] = []
    const notasFe: number[] = []
    const notas: Record<number, any> = {}

    for (const prob of modulo.problemas) {
      const ab = calcNota(prob.id, aluno.id, 'ABERTURA')
      if (typeof ab === 'number') notasAb.push(ab)

      if (prob.temSaltoTriplo) {
        const fa = calcNota(prob.id, aluno.id, 'FECHAMENTO_A')
        const fb = calcNota(prob.id, aluno.id, 'FECHAMENTO_B')
        if (typeof fa === 'number') notasFe.push(fa)
        if (typeof fb === 'number') notasFe.push(fb)
        notas[prob.numero] = { ab, fa, fb, st: true }
      } else {
        const fe = calcNota(prob.id, aluno.id, 'FECHAMENTO')
        if (typeof fe === 'number') notasFe.push(fe)
        notas[prob.numero] = { ab, fe, st: false }
      }
    }

    const mediaAb    = notasAb.length > 0 ? arredondar(notasAb.reduce((a, b) => a + b, 0) / notasAb.length) : null
    const mediaFe    = notasFe.length > 0 ? arredondar(notasFe.reduce((a, b) => a + b, 0) / notasFe.length) : null
    const notaFinal  = mediaAb !== null && mediaFe !== null ? arredondar(Math.min(mediaAb + mediaFe, 10)) : null

    return { aluno, notas, mediaAb, mediaFe, notaFinal }
  })

  // ── Encontros a detalhar ─────────────────────────────────────
  type TipoEnc = 'ABERTURA' | 'FECHAMENTO' | 'FECHAMENTO_A' | 'FECHAMENTO_B'
  const encontros: { prob: typeof modulo.problemas[0]; tipo: TipoEnc }[] = []
  for (const prob of modulo.problemas) {
    encontros.push({ prob, tipo: 'ABERTURA' })
    if (prob.temSaltoTriplo) {
      encontros.push({ prob, tipo: 'FECHAMENTO_A' })
      encontros.push({ prob, tipo: 'FECHAMENTO_B' })
    } else {
      encontros.push({ prob, tipo: 'FECHAMENTO' })
    }
  }

  const semLabel = modulo.semestre === '01' ? '1º Semestre' : modulo.semestre === '02' ? '2º Semestre' : modulo.semestre

  return (
    <>
      {/* ── CSS global para impressão ──────────────────────────── */}
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; background: white; }

        .no-print { }
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; }
          body { font-size: 10px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }

        .page { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }

        /* Cabeçalho */
        .header { border-bottom: 3px solid #1F4E79; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; font-weight: bold; color: #1F4E79; margin: 0 0 4px; }
        .header .meta { font-size: 11px; color: #555; display: flex; gap: 24px; flex-wrap: wrap; }

        /* Seção */
        .section { margin-bottom: 32px; }
        .section-title {
          background: #1F4E79; color: white;
          font-size: 12px; font-weight: bold;
          padding: 6px 12px; margin: 0 0 8px;
          border-radius: 4px;
        }
        .subsection-title {
          background: #2E75B6; color: white;
          font-size: 11px; font-weight: bold;
          padding: 4px 10px; margin: 16px 0 6px;
          border-radius: 3px;
        }

        /* Tabelas */
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #1F4E79; color: white; padding: 5px 6px; text-align: center; font-weight: bold; }
        th.left { text-align: left; }
        td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; text-align: center; }
        td.left { text-align: left; }
        tr:nth-child(even) td { background: #f8f9fb; }
        tr:hover td { background: #eff6ff; }

        .nota-final { font-weight: bold; color: #1F4E79; font-size: 11px; }
        .nota-sat { color: #16a34a; font-weight: bold; font-size: 9px; }
        .nota-vazia { color: #9ca3af; }
        .faltou { color: #dc2626; font-size: 9px; font-weight: bold; }
        .comp { color: #16a34a; font-size: 9px; font-weight: bold; }

        /* Legenda */
        .legenda { font-size: 9px; color: #6b7280; margin-top: 6px; line-height: 1.6; }

        /* Botão impressão */
        .print-btn {
          position: fixed; top: 16px; right: 16px; z-index: 100;
          background: #1F4E79; color: white;
          border: none; padding: 10px 20px;
          border-radius: 8px; font-size: 13px; font-weight: bold;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex; align-items: center; gap: 8px;
        }
        .print-btn:hover { background: #163d61; }
        .back-btn {
          position: fixed; top: 16px; left: 16px; z-index: 100;
          background: white; color: #1F4E79;
          border: 2px solid #1F4E79; padding: 8px 16px;
          border-radius: 8px; font-size: 12px; font-weight: bold;
          cursor: pointer; text-decoration: none;
          display: flex; align-items: center; gap: 6px;
        }
      `}</style>

      {/* ── Botões (não aparecem na impressão) ────────────────── */}
      <div className="no-print">
        <a href={`/professor/relatorios?moduloId=${moduloId}`} className="back-btn">
          ← Voltar
        </a>
        <button className="print-btn" onClick="window.print()">
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>

      <div className="page">

        {/* ══════════════════════════════════════════════════════
            CABEÇALHO
        ══════════════════════════════════════════════════════ */}
        <div className="header">
          <h1>Relatório de Notas — {modulo.nome}</h1>
          <div className="meta">
            <span>📚 {modulo.tutoria} · Turma {modulo.turma} · {modulo.ano} · {semLabel}</span>
            <span>👤 Prof. {modulo.tutor.nome}</span>
            <span>👥 {alunos.length} alunos · {modulo.problemas.length} problemas</span>
            <span>📅 Gerado em {hoje}</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SEÇÃO 1 — RESUMO MT (Nota Formativa Final)
        ══════════════════════════════════════════════════════ */}
        <div className="section">
          <div className="section-title">1. Resumo MT — Nota Formativa</div>
          <table>
            <thead>
              <tr>
                <th className="left" rowSpan={2}>Aluno</th>
                {modulo.problemas.map((p) => (
                  <th
                    key={p.id}
                    colSpan={p.temSaltoTriplo ? 3 : 2}
                  >
                    P{p.numero}{p.temSaltoTriplo ? ' (ST)' : ''}
                  </th>
                ))}
                <th rowSpan={2}>Méd. Ab</th>
                <th rowSpan={2}>Méd. Fe</th>
                <th rowSpan={2}>Formativa</th>
              </tr>
              <tr>
                {modulo.problemas.map((p) =>
                  p.temSaltoTriplo ? (
                    <>
                      <th key={`${p.id}-ab`}>Ab</th>
                      <th key={`${p.id}-fa`}>FeA</th>
                      <th key={`${p.id}-fb`}>FeB</th>
                    </>
                  ) : (
                    <>
                      <th key={`${p.id}-ab`}>Ab</th>
                      <th key={`${p.id}-fe`}>Fe</th>
                    </>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {resumo.map(({ aluno, notas, mediaAb, mediaFe, notaFinal }) => (
                <tr key={aluno.id}>
                  <td className="left">{aluno.nome}</td>
                  {modulo.problemas.map((p) => {
                    const np = notas[p.numero]
                    if (!np) return p.temSaltoTriplo
                      ? <><td key={`${p.id}-ab`} className="nota-vazia">—</td><td key={`${p.id}-fa`} className="nota-vazia">—</td><td key={`${p.id}-fb`} className="nota-vazia">—</td></>
                      : <><td key={`${p.id}-ab`} className="nota-vazia">—</td><td key={`${p.id}-fe`} className="nota-vazia">—</td></>

                    const fmtV = (v: any) => {
                      if (v === null || v === undefined) return <span className="nota-vazia">—</span>
                      if (v === 'SATISFATORIO') return <span className="nota-sat">SAT</span>
                      if (typeof v === 'number') return v.toFixed(2)
                      return String(v)
                    }

                    return p.temSaltoTriplo ? (
                      <>
                        <td key={`${p.id}-ab`}>{fmtV(np.ab)}</td>
                        <td key={`${p.id}-fa`}>{fmtV(np.fa)}</td>
                        <td key={`${p.id}-fb`}>{fmtV(np.fb)}</td>
                      </>
                    ) : (
                      <>
                        <td key={`${p.id}-ab`}>{fmtV(np.ab)}</td>
                        <td key={`${p.id}-fe`}>{fmtV(np.fe)}</td>
                      </>
                    )
                  })}
                  <td>{n(mediaAb)}</td>
                  <td>{n(mediaFe)}</td>
                  <td className="nota-final">{notaFinal !== null ? notaFinal.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legenda">
            Formativa = Méd. Aberturas + Méd. Fechamentos (máx 10) · SAT = Atividade Compensatória (excluído das médias) · — = sem dados
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SEÇÃO 2 — DETALHE POR ENCONTRO
        ══════════════════════════════════════════════════════ */}
        <div className="section page-break">
          <div className="section-title">2. Detalhe por Encontro</div>

          {encontros.map(({ prob, tipo }, idx) => {
            const labelTipo = getLabelTipo(tipo as any)
            const criterios = getCriterios(tipo as any)

            return (
              <div key={`${prob.id}-${tipo}`} className={idx > 0 ? '' : ''}>
                <div className="subsection-title">
                  Problema {prob.numero} — {prob.nome ?? `P${prob.numero}`} · {labelTipo}
                </div>

                <table>
                  <thead>
                    <tr>
                      <th className="left" rowSpan={2}>Aluno</th>

                      {/* Colunas do Tutor */}
                      <th colSpan={5} style={{ background: '#1e3a5f' }}>
                        Tutor
                      </th>

                      {/* Colunas Auto-avaliação */}
                      <th colSpan={5} style={{ background: '#0d6b3e' }}>
                        Auto-avaliação
                      </th>

                      {/* Colunas Interpares (uma coluna por aluno avaliador) */}
                      <th colSpan={alunos.length} style={{ background: '#7c3aed' }}>
                        Interpares (M-At de cada avaliador)
                      </th>

                      <th rowSpan={2}>Méd. Inter</th>
                      <th rowSpan={2} style={{ background: '#1F4E79', minWidth: 52 }}>
                        Nota Final
                      </th>
                    </tr>
                    <tr>
                      {/* Tutor sub-headers */}
                      {criterios.map((c) => (
                        <th key={`t-${c.campo}`} style={{ background: '#274e7a', fontSize: 9 }}>
                          {c.label}
                        </th>
                      ))}
                      <th style={{ background: '#274e7a', fontSize: 9 }}>At.</th>
                      <th style={{ background: '#274e7a', fontSize: 9 }}>M-At</th>

                      {/* Auto sub-headers */}
                      {criterios.map((c) => (
                        <th key={`a-${c.campo}`} style={{ background: '#166534', fontSize: 9 }}>
                          {c.label}
                        </th>
                      ))}
                      <th style={{ background: '#166534', fontSize: 9 }}>At.</th>
                      <th style={{ background: '#166534', fontSize: 9 }}>M-At</th>

                      {/* Interpares: nome abreviado de cada aluno */}
                      {alunos.map((a) => (
                        <th key={`ip-${a.id}`} style={{ background: '#5b21b6', fontSize: 8, maxWidth: 60 }}>
                          {a.nome.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alunos.map((aluno, aIdx) => {
                      const avT = avaliacoesTutor.find(
                        (a) => a.problemaId === prob.id && a.avaliadoId === aluno.id && a.tipoEncontro === tipo
                      )
                      const avSelf = avaliacoesAluno.find(
                        (a) => a.problemaId === prob.id && a.avaliadorId === aluno.id
                            && a.avaliadoId === aluno.id && a.tipoEncontro === tipo
                      )
                      const avaliacoesDoPar = alunos.map((avaliador) => {
                        if (avaliador.id === aluno.id) return null
                        return avaliacoesAluno.find(
                          (a) => a.problemaId === prob.id && a.avaliadorId === avaliador.id
                              && a.avaliadoId === aluno.id && a.tipoEncontro === tipo
                        ) ?? null
                      })

                      const matTutor = avT
                        ? calcMMenosAtTutor(Number(avT.c1), Number(avT.c2), Number(avT.c3), Number(avT.atitudes), avT.ativCompensatoria)
                        : null
                      const matSelf = avSelf
                        ? calcMMenosAtAluno(Number(avSelf.c1), Number(avSelf.c2), Number(avSelf.c3), Number(avSelf.atitudes))
                        : null

                      // interpares de cada colega
                      const matParesValues = avaliacoesDoPar.map((av) =>
                        av ? calcMMenosAtAluno(Number(av.c1), Number(av.c2), Number(av.c3), Number(av.atitudes)) : null
                      )
                      const matParesNumeric = matParesValues.filter((v): v is number => v !== null)
                      const mediaPares = matParesNumeric.length > 0
                        ? matParesNumeric.reduce((a, b) => a + b, 0) / matParesNumeric.length
                        : null

                      const notaFinalEncontro = calcNota(prob.id, aluno.id, tipo)

                      return (
                        <tr key={aluno.id}>
                          <td className="left">
                            {aIdx + 1}. {aluno.nome}
                            {avT?.faltou && <span className="faltou"> FALTOU</span>}
                            {avT?.ativCompensatoria && <span className="comp"> COMP</span>}
                          </td>

                          {/* Tutor */}
                          {criterios.map((c) => (
                            <td key={`tv-${c.campo}`} style={{ color: avT?.faltou ? '#9ca3af' : undefined }}>
                              {avT ? Number((avT as any)[c.campo]).toFixed(1) : '—'}
                            </td>
                          ))}
                          <td style={{ color: avT?.faltou ? '#9ca3af' : undefined }}>
                            {avT ? Number(avT.atitudes).toFixed(1) : '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#1e3a5f' }}>
                            {matTutor === null ? '—'
                              : matTutor === 'SATISFATORIO' ? <span className="nota-sat">SAT</span>
                              : matTutor.toFixed(2)}
                          </td>

                          {/* Auto-avaliação */}
                          {criterios.map((c) => (
                            <td key={`av-${c.campo}`} style={{ color: '#166534' }}>
                              {avSelf ? Number((avSelf as any)[c.campo]).toFixed(1) : '—'}
                            </td>
                          ))}
                          <td style={{ color: '#166534' }}>
                            {avSelf ? Number(avSelf.atitudes).toFixed(1) : '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#166534' }}>
                            {matSelf !== null ? matSelf.toFixed(2) : '—'}
                          </td>

                          {/* Interpares: M-At de cada avaliador */}
                          {alunos.map((avaliador, vIdx) => {
                            if (avaliador.id === aluno.id) {
                              return <td key={`ip-${vIdx}`} style={{ background: '#f3f4f6', color: '#9ca3af', fontSize: 9 }}>—</td>
                            }
                            const v = matParesValues[vIdx]
                            return (
                              <td key={`ip-${vIdx}`} style={{ color: '#5b21b6' }}>
                                {v !== null ? v.toFixed(2) : <span className="nota-vazia">—</span>}
                              </td>
                            )
                          })}

                          {/* Média interpares */}
                          <td style={{ fontWeight: 600, color: '#7c3aed' }}>
                            {mediaPares !== null ? mediaPares.toFixed(2) : '—'}
                          </td>

                          {/* Nota final */}
                          <td className="nota-final" style={{ fontSize: 12 }}>
                            {notaFinalEncontro === null ? <span className="nota-vazia">—</span>
                              : notaFinalEncontro === 'SATISFATORIO' ? <span className="nota-sat">SAT</span>
                              : notaFinalEncontro.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Legenda dos critérios */}
                <div className="legenda">
                  {criterios.map((c) => `${c.label} = ${c.nome}`).join(' · ')}
                  {' · '}At. = Atitudes (0–1)
                  {' · '}M-At = Média − Atitudes
                  {' · '}Nota Final = (Inter×0,5 + Auto×0,5 + Tutor×4) / {/* */}5 (ou /4,5 sem auto)
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Rodapé ────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 24, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>
          TutoriaAvalia v2 · CESUPA · Relatório gerado em {hoje} · {modulo.nome} · {modulo.tutoria} · Turma {modulo.turma} · {modulo.ano}
        </div>

      </div>

      {/* Script do botão de impressão */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelector('.print-btn').addEventListener('click', function() {
          window.print();
        });
      `}} />
    </>
  )
}
