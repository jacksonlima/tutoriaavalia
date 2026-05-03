'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession }                     from 'next-auth/react'
import { useSearchParams, useRouter }     from 'next/navigation'
import { TopBar }                         from '@/components/ui/TopBar'
import { useToast }                       from '@/components/ui/use-toast'
import { getCriterios, getLabelTipo, OPCOES_ATITUDES, TipoEncontroForm, CampoNota } from '@/lib/criterios'
import { JanelaComplementarManager }      from '@/components/professor/JanelaComplementarManager'
import { salvarAvaliacoesTutor }          from './actions'

type Aluno = { id: string; nome: string; visitante?: boolean }
type NotaAluno = {
  avaliadoId:        string
  c1:                number
  c2:                number
  c3:                number
  atitudes:          number
  ativCompensatoria: boolean
  faltou:            boolean
}

function DropdownNota({
  valor, opcoes, onChange, disabled = false, label,
}: {
  valor: number; opcoes: number[]; onChange: (v: number) => void; disabled?: boolean; label?: string
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      aria-label={label}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-[#2E75B6] disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer"
    >
      {opcoes.map((op) => (
        <option key={op} value={op}>{op.toFixed(1)}</option>
      ))}
    </select>
  )
}

function AvaliarTutorPageInner() {
  const { data: session } = useSession()
  const searchParams      = useSearchParams()
  const { toast }         = useToast()

  const problemaId   = searchParams.get('problemaId') ?? ''
  const tipo         = (searchParams.get('tipo') ?? 'ABERTURA') as TipoEncontroForm
  const problemaNome = searchParams.get('nome') ?? ''

  const [alunos,          setAlunos]     = useState<Aluno[]>([])
  const [notas,           setNotas]      = useState<Record<string, NotaAluno>>({})
  const [visitantesIds,   setVisitantesIds] = useState<Set<string>>(new Set())
  const [carregando,      setCarregando] = useState(true)
  const [salvando,        setSalvando]   = useState(false)

  const criterios = getCriterios(tipo)
  const labelTipo = getLabelTipo(tipo)

  // ── Carregamento: grupo (regulares + visitantes) + avaliações ─────────────
  useEffect(() => {
    if (!problemaId) return

    setCarregando(true)

    Promise.all([
      // grupo API: já inclui visitantes para TUTOR
      fetch(`/api/encontros-especiais/grupo?problemaId=${problemaId}&tipoEncontro=${tipo}`)
        .then((r) => r.json()),
      // avaliações existentes
      fetch(`/api/avaliacoes/tutor?problemaId=${problemaId}&tipoEncontro=${tipo}`)
        .then((r) => r.json()),
    ]).then(([grupoData, avalData]: [any, any[]]) => {
      // Mapeia avaliações existentes por avaliadoId
      const notasExistentes: Record<string, NotaAluno> = {}
      for (const av of (avalData ?? [])) {
        notasExistentes[av.avaliadoId] = {
          avaliadoId:        av.avaliadoId,
          c1:                Number(av.c1),
          c2:                Number(av.c2),
          c3:                Number(av.c3),
          atitudes:          Number(av.atitudes),
          ativCompensatoria: av.ativCompensatoria,
          faltou:            av.faltou ?? false,
        }
      }

      // Grupo efetivo da API (inclui visitantes)
      const grupoAlunos: Aluno[] = grupoData.grupo ?? []
      const vIds = new Set<string>((grupoData.visitantes ?? []).map((v: Aluno) => v.id))
      setVisitantesIds(vIds)

      // Nota inicial: existente ou zero
      const notasInit: Record<string, NotaAluno> = {}
      for (const a of grupoAlunos) {
        notasInit[a.id] = notasExistentes[a.id] ?? {
          avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false, faltou: false,
        }
      }

      setAlunos(grupoAlunos)
      setNotas(notasInit)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [problemaId, tipo])

  // Recarrega grupo após janela complementar atualizar (novo aluno matriculado)
  const handleJanelaAtualizada = async () => {
    if (!problemaId) return
    const grupoData = await fetch(
      `/api/encontros-especiais/grupo?problemaId=${problemaId}&tipoEncontro=${tipo}`
    ).then((r) => r.json())

    const grupoAlunos: Aluno[] = grupoData.grupo ?? []
    setAlunos((prev) => {
      const existentesIds = new Set(prev.map((a) => a.id))
      const novos = grupoAlunos.filter((a) => !existentesIds.has(a.id))
      if (novos.length === 0) return prev
      setNotas((n) => {
        const copy = { ...n }
        for (const a of novos) {
          copy[a.id] = { avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false, faltou: false }
        }
        return copy
      })
      return grupoAlunos
    })
  }

  const setNota = (alunoId: string, campo: CampoNota | 'ativCompensatoria' | 'faltou', valor: number | boolean) => {
    setNotas((prev) => ({ ...prev, [alunoId]: { ...prev[alunoId], [campo]: valor } }))
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const resposta = await salvarAvaliacoesTutor({
        problemaId,
        tipoEncontro: tipo,
        avaliacoes: Object.values(notas).map((av) => ({
          avaliadoId:        av.avaliadoId,
          c1:                Number(av.c1       ?? 0),
          c2:                Number(av.c2       ?? 0),
          c3:                Number(av.c3       ?? 0),
          atitudes:          Number(av.atitudes ?? 0),
          ativCompensatoria: Boolean(av.ativCompensatoria),
          faltou:            Boolean(av.faltou  ?? false),
        })),
      })
      if (!resposta.sucesso) throw new Error(resposta.erro || 'Erro desconhecido.')
      toast({ title: `Rascunho salvo! ${resposta.quantidadeSalva} alunos avaliados.` })
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const calcMedia = (n: NotaAluno) => (n.c1 + n.c2 + n.c3) / 3
  const calcMAt   = (n: NotaAluno) =>
    n.faltou ? '—' : n.ativCompensatoria ? 'SATISFATÓRIO' : (calcMedia(n) - n.atitudes).toFixed(2)

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  const temVisitantes = visitantesIds.size > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
      <main className="max-w-5xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1F4E79]">
            {problemaNome || 'Avaliação'} — {labelTipo}
          </h1>
          {temVisitantes && (
            <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-purple-500">🔄</span>
              <p className="text-xs text-purple-700">
                <span className="font-bold">Situação Excepcional:</span> este grupo recebeu{' '}
                <span className="font-bold">{visitantesIds.size}</span>{' '}
                {visitantesIds.size === 1 ? 'aluno visitante' : 'alunos visitantes'} de outra tutoria.
                Avalie todos normalmente.
              </p>
            </div>
          )}
        </div>

        {/* ── Janela Complementar ─────────────────────────────────────────── */}
        {problemaId && (
          <JanelaComplementarManager
            problemaId={problemaId}
            tipoEncontro={tipo}
            nomeProblema={problemaNome || 'Problema'}
            labelTipo={labelTipo}
            onJanelaAtualizada={handleJanelaAtualizada}
          />
        )}

        {/* ── Tabela mobile ─────────────────────────────────────────────── */}
        <div className="space-y-4 md:hidden mt-4">
          {alunos.map((aluno, idx) => {
            const n = notas[aluno.id] ?? { avaliadoId: aluno.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false, faltou: false }
            const eVisitante = visitantesIds.has(aluno.id)
            return (
              <div key={aluno.id} className={`bg-white rounded-xl border p-4 ${eVisitante ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className={`font-semibold text-sm ${n.faltou ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                      {idx + 1}. {aluno.nome}
                    </span>
                    {eVisitante && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                        visitante
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-red-500 cursor-pointer font-medium">
                      <input type="checkbox" checked={n.faltou}
                        onChange={(e) => setNota(aluno.id, 'faltou', e.target.checked)}
                        className="w-4 h-4 accent-red-500" />
                      Faltou
                    </label>
                    {!n.faltou && (
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={n.ativCompensatoria}
                          onChange={(e) => setNota(aluno.id, 'ativCompensatoria', e.target.checked)}
                          className="w-4 h-4" />
                        Ativ. Comp. Satisfatória?
                      </label>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {criterios.map((c) => (
                    <div key={c.campo}>
                      <label className="block text-xs text-gray-500 mb-1">
                        <span className="font-semibold text-[#1F4E79]">{c.label}</span> — {c.nome}
                      </label>
                      <DropdownNota
                        valor={n[c.campo] as number}
                        opcoes={c.opcoes}
                        onChange={(v) => setNota(aluno.id, c.campo, v)}
                        disabled={n.faltou || n.ativCompensatoria}
                        label={c.nome}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      <span className="font-semibold text-[#1F4E79]">Atitudes</span>
                    </label>
                    <DropdownNota
                      valor={n.atitudes}
                      opcoes={OPCOES_ATITUDES}
                      onChange={(v) => setNota(aluno.id, 'atitudes', v)}
                      disabled={n.faltou || n.ativCompensatoria}
                      label="Atitudes"
                    />
                  </div>
                </div>
                {n.faltou && (
                  <div className="mt-2 text-xs text-red-400 font-medium text-center">
                    ⚠️ Aluno faltoso — notas interpares ignoradas
                  </div>
                )}
                <div className="mt-3 text-right text-xs text-gray-500">
                  M = {calcMedia(n).toFixed(2)} · M−At = <span className="font-bold text-[#1F4E79]">{calcMAt(n)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Tabela desktop ────────────────────────────────────────────── */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1F4E79] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-medium min-w-[200px]">Aluno</th>
                  {criterios.map((c) => (
                    <th key={c.campo} className="px-3 py-3 font-medium text-center min-w-[120px]">
                      <div className="text-white font-bold">{c.label}</div>
                      <div className="text-blue-200 text-xs font-normal leading-tight mt-0.5 max-w-[120px] whitespace-normal">{c.nome}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium text-center min-w-[100px]">
                    <div>Atitudes</div>
                    <div className="text-blue-200 text-xs font-normal">(0–1)</div>
                  </th>
                  <th className="px-3 py-3 font-medium text-center text-red-300">Faltou</th>
                  <th className="px-3 py-3 font-medium text-center">Ativ. Comp. Satisfatória?</th>
                  <th className="px-3 py-3 font-medium text-center">M−At</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno, idx) => {
                  const n = notas[aluno.id] ?? { avaliadoId: aluno.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false, faltou: false }
                  const eVisitante = visitantesIds.has(aluno.id)
                  return (
                    <tr key={aluno.id} className={
                      n.faltou ? 'bg-red-50 opacity-70' :
                      eVisitante ? 'bg-purple-50' :
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }>
                      <td className={`px-4 py-2 font-medium ${n.faltou ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                        <div className="flex items-center gap-2">
                          {aluno.nome}
                          {eVisitante && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                              🔄 visitante
                            </span>
                          )}
                        </div>
                      </td>
                      {criterios.map((c) => (
                        <td key={c.campo} className="px-2 py-2">
                          <DropdownNota
                            valor={n[c.campo] as number}
                            opcoes={c.opcoes}
                            onChange={(v) => setNota(aluno.id, c.campo, v)}
                            disabled={n.faltou || n.ativCompensatoria}
                            label={c.nome}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <DropdownNota
                          valor={n.atitudes}
                          opcoes={OPCOES_ATITUDES}
                          onChange={(v) => setNota(aluno.id, 'atitudes', v)}
                          disabled={n.faltou || n.ativCompensatoria}
                          label="Atitudes"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={n.faltou}
                          onChange={(e) => setNota(aluno.id, 'faltou', e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-red-500" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={n.ativCompensatoria}
                          onChange={(e) => setNota(aluno.id, 'ativCompensatoria', e.target.checked)}
                          disabled={n.faltou}
                          className="w-4 h-4 cursor-pointer disabled:opacity-30" />
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-[#1F4E79]">
                        {calcMAt(n)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5">
          <button onClick={salvar} disabled={salvando}
            className="w-full bg-[#1F4E79] text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
            {salvando
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</>
              : 'Salvar Notas'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default function AvaliarTutorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    }>
      <AvaliarTutorPageInner />
    </Suspense>
  )
}
