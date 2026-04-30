'use client'

/**
 * TutoriaAvalia v2 — Página de Avaliação do Aluno (interpares + auto-avaliação)
 * Autor: Jackson Lima — CESUPA
 *
 * Suporta dois modos:
 *   NORMAL:       avalia todos os colegas da turma (trava após submissão)
 *   COMPLEMENTAR: avalia apenas o(s) aluno(s) de janelas abertas (não trava submissão normal)
 *
 * IMPORTANTE: useSearchParams() exige <Suspense> no Next.js 13+.
 * O componente real está em AlunoAvaliarContent; a exportação default
 * envolve tudo em Suspense para satisfazer o requisito do framework.
 */

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar }     from '@/components/ui/TopBar'
import { useToast }   from '@/components/ui/use-toast'
import {
  getCriterios,
  getLabelTipo,
  OPCOES_ATITUDES,
  TipoEncontroForm,
  CampoNota,
} from '@/lib/criterios'

type Aluno     = { id: string; nome: string }
type NotaAluno = { avaliadoId: string; c1: number; c2: number; c3: number; atitudes: number }
type JanelaInfo = { id: string; alunoId: string; aluno: { id: string; nome: string } }

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

// ── Componente interno (usa useSearchParams — precisa de Suspense) ─────────
function AlunoAvaliarContent() {
  const { data: session } = useSession()
  const params    = useSearchParams()
  const router    = useRouter()
  const { toast } = useToast()

  const problemaId  = params.get('problemaId') ?? ''
  const tipo        = (params.get('tipo') ?? 'ABERTURA') as TipoEncontroForm
  const nomeProblem = params.get('nome') ?? ''

  const [alunos,           setAlunos]           = useState<Aluno[]>([])
  const [notas,            setNotas]             = useState<Record<string, NotaAluno>>({})
  const [cardAtual,        setCardAtual]         = useState(0)
  const [fase,             setFase]              = useState<'formulario' | 'revisao' | 'concluido'>('formulario')
  const [carregando,       setCarregando]        = useState(true)
  const [enviando,         setEnviando]          = useState(false)
  const [modoComplementar, setModoComplementar]  = useState(false)
  const [janelasInfo,      setJanelasInfo]       = useState<JanelaInfo[]>([])

  const criterios = getCriterios(tipo)
  const labelTipo = getLabelTipo(tipo)

  useEffect(() => {
    if (!problemaId) return

    Promise.all([
      fetch(`/api/avaliacoes/aluno?problemaId=${problemaId}&tipoEncontro=${tipo}`).then((r) => r.json()),
      fetch('/api/modulos').then((r) => r.json()),
    ]).then(([avalData, modulos]: [any, any[]]) => {
      const janelasAbertas: JanelaInfo[] = avalData.janelasAbertas ?? []
      // API já calcula corretamente:
      // - aluno tardio (euSouOTardio=true) → modoComplementar=false, janelasAbertas=[]
      // - outros alunos com janela aberta  → modoComplementar=true
      const emComplementar = avalData.modoComplementar ?? (janelasAbertas.length > 0)

      setModoComplementar(emComplementar)
      setJanelasInfo(janelasAbertas)

      // Busca a lista de alunos do módulo (sempre — mesmo se já submeteu, para exibir notas)
      for (const m of modulos) {
        const prob = m.problemas?.find((p: any) => p.id === problemaId)
        if (prob) {
          const todosAlunos: Aluno[] = m.matriculas.map((ma: any) => ma.usuario)

          let alunosParaAvaliar: Aluno[]

          if (emComplementar) {
            // MODO COMPLEMENTAR (outros alunos): só mostra os alunos das janelas abertas
            const idsJanelas = new Set(janelasAbertas.map((j) => j.alunoId))
            alunosParaAvaliar = todosAlunos.filter((a) => idsJanelas.has(a.id))
          } else {
            // MODO NORMAL (inclui aluno tardio): todos os alunos, logado primeiro
            const euMesmo = todosAlunos.find((a) => a.id === session?.user?.id)
            const outros  = todosAlunos.filter((a) => a.id !== session?.user?.id)
            alunosParaAvaliar = euMesmo ? [euMesmo, ...outros] : todosAlunos
          }

          setAlunos(alunosParaAvaliar)

          // Pré-preenche com avaliações já salvas (se houver)
          const init: Record<string, NotaAluno> = {}
          for (const a of alunosParaAvaliar) {
            const existente = avalData.avaliacoes?.find(
              (av: any) => av.avaliadoId === a.id,
            )
            init[a.id] = existente
              ? { avaliadoId: a.id, c1: existente.c1, c2: existente.c2, c3: existente.c3, atitudes: existente.atitudes }
              : { avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0 }
          }
          setNotas(init)

          // Só vai para concluído APÓS carregar as notas (para exibição)
          if (avalData.submetido && !emComplementar) {
            setFase('concluido')
          }

          break
        }
      }
      setCarregando(false)
    })
  }, [problemaId, tipo, session?.user?.id])

  const setNota = (alunoId: string, campo: CampoNota, valor: number) => {
    setNotas((prev) => ({ ...prev, [alunoId]: { ...prev[alunoId], [campo]: valor } }))
  }

  const enviar = async () => {
    setEnviando(true)
    try {
      const res = await fetch('/api/avaliacoes/aluno', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          problemaId,
          tipoEncontro: tipo,
          avaliacoes:   Object.values(notas),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setFase('concluido')
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const toNum = (v: any) => Number(v ?? 0)
  const calcMAt = (n: NotaAluno) =>
    ((toNum(n.c1) + toNum(n.c2) + toNum(n.c3)) / 3 - toNum(n.atitudes)).toFixed(2)

  const alunoAtual = alunos[cardAtual]
  const notaAtual  = alunoAtual ? notas[alunoAtual.id] : null
  const eVoce      = alunoAtual?.id === session?.user?.id
  const progresso  = alunos.length > 0 ? Math.round((cardAtual / alunos.length) * 100) : 0

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  // ── CONCLUÍDO — mostra notas lançadas em modo somente leitura ───────────
  if (fase === 'concluido') {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" />
        <main className="max-w-lg mx-auto px-4 py-6">

          {/* Banner de confirmação */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h1 className="text-base font-bold text-green-800 mb-1">
              {modoComplementar ? 'Avaliação complementar enviada!' : 'Avaliação enviada!'}
            </h1>
            <p className="text-xs text-green-600">
              Notas registradas — somente leitura
            </p>
          </div>

          {/* Notas lançadas — somente leitura */}
          {alunos.length > 0 && (
            <div className="space-y-3 mb-5">
              {alunos.map((aluno) => {
                const n = notas[aluno.id]
                if (!n) return null
                const eEuMesmo = aluno.id === session?.user?.id
                return (
                  <div key={aluno.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-sm text-gray-800">
                        {aluno.nome}
                        {eEuMesmo && (
                          <span className="ml-2 text-xs text-blue-500">(Você)</span>
                        )}
                      </p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        🔒 Enviado
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {criterios.map((c) => (
                        <div key={c.campo} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            <span className="font-semibold text-[#1F4E79]">{c.label}</span>
                            {' '}— {c.nome.length > 40 ? c.nome.substring(0, 40) + '...' : c.nome}
                          </span>
                          <span className="font-bold text-gray-800 ml-2 shrink-0">
                            {Number(n[c.campo] ?? 0).toFixed(1)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          <span className="font-semibold text-[#1F4E79]">Atitudes</span>
                        </span>
                        <span className="font-bold text-gray-800 ml-2">
                          {Number(n.atitudes ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 text-right text-xs text-gray-400">
                      M−At = <span className="font-bold text-[#1F4E79]">{calcMAt(n)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => router.push('/aluno/dashboard')}
            className="w-full bg-[#1F4E79] text-white px-6 py-2.5 rounded-lg text-sm font-medium"
          >
            Voltar ao início
          </button>
        </main>
      </div>
    )
  }

  // ── REVISÃO ───────────────────────────────────────────────────────────────
  if (fase === 'revisao') {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#1F4E79]">Revise antes de enviar</h1>
            <p className="text-sm text-gray-400">{nomeProblem} — {labelTipo}</p>
            {modoComplementar && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                🧑‍🎓 Avaliação complementar — colega que chegou tarde
              </div>
            )}
          </div>

          <div className="space-y-3 mb-6">
            {alunos.map((aluno) => {
              const n = notas[aluno.id]
              return (
                <div key={aluno.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-sm text-gray-800 mb-3">
                    {aluno.nome}
                    {aluno.id === session?.user?.id && (
                      <span className="text-blue-500 text-xs ml-2">(Você)</span>
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
                          {Number(n[c.campo] ?? 0).toFixed(1)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        <span className="font-semibold text-[#1F4E79]">Atitudes</span>
                      </span>
                      <span className="font-bold text-gray-800 ml-2">{Number(n.atitudes ?? 0).toFixed(1)}</span>
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
            {modoComplementar
              ? 'Após confirmar, esta avaliação complementar será registrada.'
              : 'Após confirmar, não será possível alterar suas notas.'}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setFase('formulario'); setCardAtual(0) }}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              Corrigir
            </button>
            <button
              onClick={enviar}
              disabled={enviando}
              className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {enviando ? 'Enviando...' : 'Confirmar Envio'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── FORMULÁRIO (card por card) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" />
      <main className="max-w-lg mx-auto px-4 py-6">

        {/* Banner de modo complementar */}
        {modoComplementar && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 flex items-start gap-2">
            <span className="text-xl">🧑‍🎓</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Avaliação complementar</p>
              <p className="text-xs text-amber-700">
                Um colega chegou tarde à tutoria. Avalie{' '}
                {janelasInfo.map((j) => j.aluno.nome).join(', ')}
                {' '}para registrar a participação {/* normalização da frase */}
              </p>
            </div>
          </div>
        )}

        <div className="mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{nomeProblem} — {labelTipo}</p>
          <h1 className="text-xl font-bold text-[#1F4E79] mt-0.5">
            {modoComplementar ? 'Avaliar Colega Tardio' : 'Avaliar Colegas'}
          </h1>
        </div>

        {/* Barra de progresso */}
        <div className="bg-gray-200 rounded-full h-1.5 mb-1">
          <div
            className="bg-[#2E75B6] h-1.5 rounded-full transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right mb-4">
          {cardAtual + 1} de {alunos.length}
        </p>

        {/* Card do aluno atual */}
        {alunoAtual && notaAtual && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="text-center mb-5">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 ${
                eVoce ? 'bg-green-600 ring-4 ring-green-200' : 'bg-[#1F4E79]'
              }`}>
                <span className="text-white text-xl font-bold">
                  {alunoAtual.nome.charAt(0)}
                </span>
              </div>

              {modoComplementar ? (
                <div className="mb-1">
                  <span className="inline-block bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    🧑‍🎓 ALUNO TARDIO — Avalie sua participação
                  </span>
                </div>
              ) : eVoce ? (
                <div className="mb-1">
                  <span className="inline-block bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    AUTO-AVALIAÇÃO — Avalie você mesmo
                  </span>
                </div>
              ) : (
                <div className="mb-1">
                  <span className="inline-block bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                    Avaliação Interpares — {cardAtual} de {alunos.length - 1}
                  </span>
                </div>
              )}

              <h2 className="font-bold text-gray-800 text-lg">{alunoAtual.nome}</h2>
            </div>

            <div className="space-y-4">
              {criterios.map((c) => (
                <div key={c.campo} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-[#1F4E79] bg-blue-50 px-1.5 py-0.5 rounded">
                        {c.label}
                      </span>
                      <p className="text-sm text-gray-700 mt-1 leading-snug">{c.nome}</p>
                    </div>
                    <span className="text-2xl font-bold text-[#1F4E79] ml-3 shrink-0 w-12 text-right">
                      {Number(notaAtual[c.campo] ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <DropdownNota
                    valor={Number(notaAtual[c.campo] ?? 0)}
                    opcoes={c.opcoes}
                    onChange={(v) => setNota(alunoAtual.id, c.campo, v)}
                  />
                </div>
              ))}

              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-[#1F4E79] bg-blue-50 px-1.5 py-0.5 rounded">
                      Atitudes
                    </span>
                    <p className="text-sm text-gray-700 mt-1">Avalie as atitudes durante o encontro</p>
                  </div>
                  <span className="text-2xl font-bold text-[#1F4E79] ml-3 shrink-0 w-12 text-right">
                    {Number(notaAtual.atitudes ?? 0).toFixed(1)}
                  </span>
                </div>
                <DropdownNota
                  valor={Number(notaAtual.atitudes ?? 0)}
                  opcoes={OPCOES_ATITUDES}
                  onChange={(v) => setNota(alunoAtual.id, 'atitudes', v)}
                />
              </div>
            </div>

            <div className="mt-4 bg-[#1F4E79] text-white rounded-xl p-3 text-center text-sm">
              M = {((toNum(notaAtual.c1) + toNum(notaAtual.c2) + toNum(notaAtual.c3)) / 3).toFixed(2)}
              <span className="mx-3 opacity-40">|</span>
              M−At = <span className="font-bold">{calcMAt(notaAtual)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setCardAtual((p) => Math.max(0, p - 1))}
            disabled={cardAtual === 0}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          {cardAtual < alunos.length - 1 ? (
            <button
              onClick={() => setCardAtual((p) => p + 1)}
              className="flex-1 bg-[#2E75B6] text-white px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={() => setFase('revisao')}
              className="flex-1 bg-[#1F4E79] text-white px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              Revisar
            </button>
          )}
        </div>

        <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
          {alunos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCardAtual(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === cardAtual ? 'bg-[#1F4E79] w-6' : 'bg-gray-300 w-2.5'
              }`}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

// ── Export default com Suspense (obrigatório pelo Next.js para useSearchParams) ──
export default function AlunoAvaliarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Carregando...</div>}>
      <AlunoAvaliarContent />
    </Suspense>
  )
}
