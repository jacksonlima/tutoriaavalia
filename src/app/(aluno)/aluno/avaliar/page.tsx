'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/ui/TopBar'
import { useToast } from '@/components/ui/use-toast'
import { getCriterios, getLabelTipo, OPCOES_ATITUDES, TipoEncontroForm, Criterio, CampoNota } from '@/lib/criterios'

type Aluno    = { id: string; nome: string }
type NotaAluno = { avaliadoId: string; c1: number; c2: number; c3: number; atitudes: number }

// Dropdown reutilizavel para notas
function DropdownNota({
  valor, opcoes, onChange, disabled = false,
}: {
  valor: number; opcoes: number[]; onChange: (v: number) => void; disabled?: boolean
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#2E75B6] disabled:bg-gray-50 disabled:text-gray-300 cursor-pointer"
    >
      {opcoes.map((op) => (
        <option key={op} value={op}>{op.toFixed(1)}</option>
      ))}
    </select>
  )
}

function AlunoAvaliarPageInner() {
  const { data: session } = useSession()
  const params  = useSearchParams()
  const router  = useRouter()
  const { toast } = useToast()

  const problemaId   = params.get('problemaId') ?? ''
  const tipo         = (params.get('tipo') ?? 'ABERTURA') as TipoEncontroForm
  const nomeProblem  = params.get('nome') ?? ''

  const [alunos,     setAlunos]     = useState<Aluno[]>([])
  const [notas,      setNotas]      = useState<Record<string, NotaAluno>>({})
  const [cardAtual,  setCardAtual]  = useState(0)
  const [fase,       setFase]       = useState<'formulario' | 'revisao' | 'concluido'>('formulario')
  const [carregando, setCarregando] = useState(true)
  const [enviando,   setEnviando]   = useState(false)

  const criterios = getCriterios(tipo)
  const labelTipo = getLabelTipo(tipo)

  useEffect(() => {
    if (!problemaId) return
    Promise.all([
      fetch('/api/avaliacoes/aluno?problemaId=' + problemaId + '&tipoEncontro=' + tipo).then((r) => r.json()),
      fetch('/api/modulos').then((r) => r.json()),
    ]).then(([avalData, modulos]: [any, any[]]) => {
      if (avalData.submetido) {
        // Carrega a lista de alunos e as notas já submetidas para exibir em modo somente leitura
        for (const m of modulos) {
          const prob = m.problemas?.find((p: any) => p.id === problemaId)
          if (prob) {
            const todosAlunos: Aluno[] = m.matriculas.map((ma: any) => ma.usuario)
            const euMesmo   = todosAlunos.find((a: Aluno) => a.id === session?.user?.id)
            const outros    = todosAlunos.filter((a: Aluno) => a.id !== session?.user?.id)
            const alunosArr = euMesmo ? [euMesmo, ...outros] : todosAlunos
            setAlunos(alunosArr)

            // Popula as notas a partir das avaliações já submetidas
            const notasMap: Record<string, NotaAluno> = {}
            for (const a of alunosArr) {
              // Busca a avaliação deste aluno nas avaliações retornadas pela API
              const av = (avalData.avaliacoes ?? []).find((av: any) => av.avaliadoId === a.id)
              notasMap[a.id] = {
                avaliadoId: a.id,
                c1:       av ? Number(av.c1)       : 0,
                c2:       av ? Number(av.c2)       : 0,
                c3:       av ? Number(av.c3)       : 0,
                atitudes: av ? Number(av.atitudes) : 0,
              }
            }
            setNotas(notasMap)
            break
          }
        }
        setFase('concluido')
      } else {
        for (const m of modulos) {
          const prob = m.problemas?.find((p: any) => p.id === problemaId)
          if (prob) {
            const todosAlunos: Aluno[] = m.matriculas.map((ma: any) => ma.usuario)

            // Coloca o aluno logado SEMPRE primeiro na lista (auto-avaliação no card 1)
            // Os demais ficam na ordem de numeraNaTurma (garantida pela API)
            const euMesmo = todosAlunos.find((a) => a.id === session?.user?.id)
            const outros  = todosAlunos.filter((a) => a.id !== session?.user?.id)
            const alunosArr = euMesmo ? [euMesmo, ...outros] : todosAlunos

            setAlunos(alunosArr)
            const init: Record<string, NotaAluno> = {}
            for (const a of alunosArr) {
              init[a.id] = { avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0 }
            }
            setNotas(init)
            break
          }
        }
      }
      setCarregando(false)
    })
  }, [problemaId, tipo])

  const setNota = (alunoId: string, campo: CampoNota, valor: number) => {
    setNotas((prev) => ({ ...prev, [alunoId]: { ...prev[alunoId], [campo]: valor } }))
  }

  const enviar = async () => {
    setEnviando(true)
    try {
      const res = await fetch('/api/avaliacoes/aluno', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ problemaId, tipoEncontro: tipo, avaliacoes: Object.values(notas) }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setFase('concluido')
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const calcMAt = (n: NotaAluno) =>
    ((n.c1 + n.c2 + n.c3) / 3 - n.atitudes).toFixed(2)

  const alunoAtual = alunos[cardAtual]
  const notaAtual  = alunoAtual ? notas[alunoAtual.id] : null
  const eVoce      = alunoAtual?.id === session?.user?.id
  const progresso  = alunos.length > 0 ? Math.round((cardAtual / alunos.length) * 100) : 0

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  // ── CONCLUIDO: exibe as notas enviadas em modo somente leitura ──
  if (fase === 'concluido') {
    const criterios = getCriterios(tipo)
    const labelTipo = getLabelTipo(tipo)

    const calcMAt = (n: NotaAluno) =>
      ((n.c1 + n.c2 + n.c3) / 3 - n.atitudes).toFixed(2)

    const euMesmo   = alunos.find((a) => a.id === session?.user?.id)
    const colegas   = alunos.filter((a) => a.id !== session?.user?.id)
    const ordenados = euMesmo ? [euMesmo, ...colegas] : alunos

    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" backLabel="Voltar ao início" />
        <main className="max-w-lg mx-auto px-4 py-6">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-[#1F4E79]">Notas Enviadas</h1>
              <p className="text-sm text-gray-400">{nomeProblem} — {labelTipo}</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              ✓ Enviado
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
            Somente leitura — estas notas foram registradas e não podem ser alteradas.
          </div>

          {ordenados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Carregando notas...
            </p>
          ) : (
            <div className="space-y-3">
              {ordenados.map((aluno) => {
                const n = notas[aluno.id]
                if (!n) return null
                const eVoce = aluno.id === session?.user?.id

                return (
                  <div key={aluno.id}
                    className={"bg-white rounded-xl border p-4 " + (eVoce ? "border-green-200" : "border-gray-200")}>

                    {/* Nome do avaliado */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={"w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 " +
                        (eVoce ? "bg-green-600" : "bg-[#1F4E79]")}>
                        {aluno.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{aluno.nome}</p>
                        {eVoce && (
                          <span className="text-xs text-green-600 font-medium">Auto-avaliação</span>
                        )}
                      </div>
                    </div>

                    {/* Notas dos critérios */}
                    <div className="space-y-1.5">
                      {criterios.map((c) => (
                        <div key={c.campo} className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 flex-1 pr-2">
                            <span className="font-semibold text-[#1F4E79]">{c.label}</span>
                            {' — '}
                            <span className="truncate">{c.nome}</span>
                          </span>
                          <span className="text-sm font-bold text-gray-800 shrink-0 w-10 text-right">
                            {(n[c.campo] as number).toFixed(1)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          <span className="font-semibold text-[#1F4E79]">Atitudes</span>
                        </span>
                        <span className="text-sm font-bold text-gray-800 shrink-0 w-10 text-right">
                          {n.atitudes.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* M−Atitudes */}
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-gray-400">M − Atitudes</span>
                      <span className="text-sm font-bold text-[#1F4E79]">{calcMAt(n)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => router.push('/aluno/dashboard')}
            className="w-full mt-5 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium"
          >
            Voltar ao início
          </button>
        </main>
      </div>
    )
  }

  // ── REVISAO ──────────────────────────────────────────────────────
  if (fase === 'revisao') {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" backLabel="Voltar ao início" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#1F4E79]">Revise antes de enviar</h1>
            <p className="text-sm text-gray-400">{nomeProblem} — {labelTipo}</p>
          </div>

          <div className="space-y-3 mb-6">
            {alunos.map((aluno) => {
              const n = notas[aluno.id]
              return (
                <div key={aluno.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-sm text-gray-800 mb-3">
                    {aluno.nome}
                    {aluno.id === session?.user?.id && (
                      <span className="text-blue-500 text-xs ml-2">(Voce)</span>
                    )}
                  </p>
                  <div className="space-y-1.5">
                    {criterios.map((c) => (
                      <div key={c.campo} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          <span className="font-semibold text-[#1F4E79]">{c.label}</span>
                          {' '}— {c.nome.length > 50 ? c.nome.substring(0, 50) + '...' : c.nome}
                        </span>
                        <span className="font-bold text-gray-800 ml-2 shrink-0">
                          {(n[c.campo] as number).toFixed(1)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500"><span className="font-semibold text-[#1F4E79]">Atitudes</span></span>
                      <span className="font-bold text-gray-800 ml-2">{n.atitudes.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 text-right text-xs text-gray-400">
                    M−At = <span className="font-bold text-[#1F4E79]">{calcMAt(n)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-700">
            Apos confirmar, nao sera possivel alterar suas notas.
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setFase('formulario'); setCardAtual(0) }}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium">
              Corrigir
            </button>
            <button onClick={enviar} disabled={enviando}
              className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {enviando ? 'Enviando...' : 'Confirmar Envio'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── FORMULARIO (card por card) ───────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" backLabel="Voltar ao início" />
      <main className="max-w-lg mx-auto px-4 py-6">

        <div className="mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{nomeProblem} — {labelTipo}</p>
          <h1 className="text-xl font-bold text-[#1F4E79] mt-0.5">Avaliar Colegas</h1>
        </div>

        {/* Barra de progresso */}
        <div className="bg-gray-200 rounded-full h-1.5 mb-1">
          <div className="bg-[#2E75B6] h-1.5 rounded-full transition-all" style={{ width: progresso + '%' }} />
        </div>
        <p className="text-xs text-gray-400 text-right mb-4">{cardAtual + 1} de {alunos.length}</p>

        {/* Card do aluno atual */}
        {alunoAtual && notaAtual && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            {/* Identificação do aluno */}
            <div className="text-center mb-5">
              <div className={"w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 " + (eVoce ? "bg-green-600 ring-4 ring-green-200" : "bg-[#1F4E79]")}>
                <span className="text-white text-xl font-bold">{alunoAtual.nome.charAt(0)}</span>
              </div>
              {eVoce ? (
                <div className="mb-1">
                  <span className="inline-block bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    AUTO-AVALIACAO — Avalie voce mesmo
                  </span>
                </div>
              ) : (
                <div className="mb-1">
                  <span className="inline-block bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                    Avaliacao Interpares — {cardAtual} de {alunos.length - 1}
                  </span>
                </div>
              )}
              <h2 className="font-bold text-gray-800 text-lg">{alunoAtual.nome}</h2>
            </div>

            {/* Criterios com dropdown */}
            <div className="space-y-4">
              {criterios.map((c) => (
                <div key={c.campo} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-[#1F4E79] bg-blue-50 px-1.5 py-0.5 rounded">{c.label}</span>
                      <p className="text-sm text-gray-700 mt-1 leading-snug">{c.nome}</p>
                    </div>
                    <span className="text-2xl font-bold text-[#1F4E79] ml-3 shrink-0 w-12 text-right">
                      {(notaAtual[c.campo] as number).toFixed(1)}
                    </span>
                  </div>
                  <DropdownNota
                    valor={notaAtual[c.campo] as number}
                    opcoes={c.opcoes}
                    onChange={(v) => setNota(alunoAtual.id, c.campo, v)}
                  />
                </div>
              ))}

              {/* Atitudes */}
              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-[#1F4E79] bg-blue-50 px-1.5 py-0.5 rounded">Atitudes</span>
                    <p className="text-sm text-gray-700 mt-1">Avalie as atitudes durante o encontro</p>
                  </div>
                  <span className="text-2xl font-bold text-[#1F4E79] ml-3 shrink-0 w-12 text-right">
                    {notaAtual.atitudes.toFixed(1)}
                  </span>
                </div>
                <DropdownNota
                  valor={notaAtual.atitudes}
                  opcoes={OPCOES_ATITUDES}
                  onChange={(v) => setNota(alunoAtual.id, 'atitudes', v)}
                />
              </div>
            </div>

            {/* Calculo em tempo real */}
            <div className="mt-4 bg-[#1F4E79] text-white rounded-xl p-3 text-center text-sm">
              M = {((notaAtual.c1 + notaAtual.c2 + notaAtual.c3) / 3).toFixed(2)}
              <span className="mx-3 opacity-40">|</span>
              M−At = <span className="font-bold">{calcMAt(notaAtual)}</span>
            </div>
          </div>
        )}

        {/* Navegacao entre cards */}
        <div className="flex gap-3 mt-4">
          <button onClick={() => setCardAtual((p) => Math.max(0, p - 1))} disabled={cardAtual === 0}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40">
            Anterior
          </button>
          {cardAtual < alunos.length - 1 ? (
            <button onClick={() => setCardAtual((p) => p + 1)}
              className="flex-1 bg-[#2E75B6] text-white px-4 py-2.5 rounded-lg text-sm font-medium">
              Proximo
            </button>
          ) : (
            <button onClick={() => setFase('revisao')}
              className="flex-1 bg-[#1F4E79] text-white px-4 py-2.5 rounded-lg text-sm font-medium">
              Revisar
            </button>
          )}
        </div>

        {/* Indicadores de posicao */}
        <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
          {alunos.map((_, i) => (
            <button key={i} onClick={() => setCardAtual(i)}
              className={'h-2.5 rounded-full transition-all ' + (i === cardAtual ? 'bg-[#1F4E79] w-6' : 'bg-gray-300 w-2.5')} />
          ))}
        </div>
      </main>
    </div>
  )
}

export default function AlunoAvaliarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    }>
      <AlunoAvaliarPageInner />
    </Suspense>
  )
}
