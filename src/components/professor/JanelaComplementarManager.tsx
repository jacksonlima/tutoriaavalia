'use client'

/**
 * TutoriaAvalia v2 — Componente: Gerenciador de Janela Complementar
 * Autor: Jackson Lima — CESUPA
 *
 * Permite ao professor:
 *   1. Buscar e selecionar um aluno tardio
 *   2. Abrir a janela complementar (matrícula + janela em um clique)
 *   3. Ver progresso (quem já avaliou / quem falta)
 *   4. Fechar a janela quando todos avaliarem
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast }  from '@/components/ui/use-toast'

type Aluno = { id: string; nome: string; email: string }
type Janela = {
  id:          string
  alunoId:     string
  aberta:      boolean
  criadaEm:   string
  aluno:       { id: string; nome: string }
}
type Progresso = {
  total:       number
  jaAvaliaram: number
  pendentes:   string[]
}

interface Props {
  problemaId:   string
  tipoEncontro: string
  nomeProblema: string
  labelTipo:    string
}

export function JanelaComplementarManager({
  problemaId,
  tipoEncontro,
  nomeProblema,
  labelTipo,
}: Props) {
  const { toast } = useToast()

  // ── Estado ────────────────────────────────────────────────────────────────
  const [busca,         setBusca]         = useState('')
  const [resultados,    setResultados]    = useState<Aluno[]>([])
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null)
  const [buscando,      setBuscando]      = useState(false)
  const [abrindo,       setAbrindo]       = useState(false)
  const [janelas,       setJanelas]       = useState<Janela[]>([])
  const [progressos,    setProgressos]    = useState<Record<string, Progresso>>({})
  const [expandido,     setExpandido]     = useState(false)

  // ── Carrega janelas abertas ───────────────────────────────────────────────
  const carregarJanelas = useCallback(async () => {
    const res = await fetch(
      `/api/janelas-complementares?problemaId=${problemaId}&tipoEncontro=${tipoEncontro}`,
    )
    if (!res.ok) return
    const data = await res.json()
    setJanelas(data.janelas ?? [])

    // Carrega progresso de cada janela
    for (const j of (data.janelas ?? [])) {
      const pr = await fetch(`/api/janelas-complementares/${j.id}`)
      if (pr.ok) {
        const pd = await pr.json()
        setProgressos((prev) => ({ ...prev, [j.id]: pd.progresso }))
      }
    }
  }, [problemaId, tipoEncontro])

  useEffect(() => {
    carregarJanelas()
  }, [carregarJanelas])

  // ── Busca de alunos ───────────────────────────────────────────────────────
  useEffect(() => {
    if (busca.length < 2) { setResultados([]); return }

    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/usuarios/buscar?q=${encodeURIComponent(busca)}&papel=ALUNO`)
        if (res.ok) setResultados((await res.json()).usuarios ?? [])
      } finally {
        setBuscando(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [busca])

  // ── Abrir janela ──────────────────────────────────────────────────────────
  const abrirJanela = async () => {
    if (!alunoSelecionado) return
    setAbrindo(true)
    try {
      const res = await fetch('/api/janelas-complementares', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ problemaId, alunoId: alunoSelecionado.id, tipoEncontro }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({
        title:       '✅ Janela aberta!',
        description: data.mensagem,
      })

      // Limpa seleção e recarrega
      setBusca('')
      setAlunoSelecionado(null)
      setResultados([])
      await carregarJanelas()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setAbrindo(false)
    }
  }

  // ── Fechar/reabrir janela ─────────────────────────────────────────────────
  const alterarJanela = async (janelaId: string, acao: 'fechar' | 'reabrir') => {
    try {
      const res = await fetch(`/api/janelas-complementares/${janelaId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ acao }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: acao === 'fechar' ? '🔒 Janela fechada' : '🔓 Janela reaberta',
              description: data.mensagem })
      await carregarJanelas()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const temJanelasAbertas = janelas.some((j) => j.aberta)

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mt-4">
      {/* Cabeçalho */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🧑‍🎓</span>
          <div>
            <p className="text-sm font-bold text-amber-800">
              Avaliação Complementar — Aluno Tardio
            </p>
            <p className="text-xs text-amber-600">
              {nomeProblema} · {labelTipo}
              {temJanelasAbertas && (
                <span className="ml-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                  JANELA ABERTA
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="text-amber-600 text-lg">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="mt-4 space-y-4">

          {/* ── Aviso sobre o funcionamento ─────────────────────────────── */}
          <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Como funciona:</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-700">
              <li>Busque e selecione o aluno que chegou tarde</li>
              <li>Clique em <strong>Abrir Janela</strong> — ele será matriculado automaticamente</li>
              <li>Os colegas verão um aviso e poderão avaliar <strong>somente</strong> este aluno</li>
              <li>Avaliações já enviadas <strong>não são alteradas</strong></li>
              <li>Feche a janela quando todos terminarem</li>
            </ol>
          </div>

          {/* ── Busca de aluno ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-amber-800 block">
              Buscar aluno tardio
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setAlunoSelecionado(null) }}
              placeholder="Digite nome ou e-mail do aluno..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />

            {/* Resultados da busca */}
            {buscando && (
              <p className="text-xs text-gray-400">Buscando...</p>
            )}
            {resultados.length > 0 && !alunoSelecionado && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-h-40 overflow-y-auto">
                {resultados.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setAlunoSelecionado(a); setBusca(a.nome); setResultados([]) }}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-800">{a.nome}</span>
                    <span className="text-xs text-gray-400 ml-2">{a.email}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Aluno selecionado */}
            {alunoSelecionado && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-600">✅</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">{alunoSelecionado.nome}</p>
                  <p className="text-xs text-green-600">{alunoSelecionado.email}</p>
                </div>
                <button onClick={() => { setAlunoSelecionado(null); setBusca('') }}
                  className="text-xs text-gray-400 hover:text-red-500">✕</button>
              </div>
            )}

            {/* Botão abrir janela */}
            <button
              onClick={abrirJanela}
              disabled={!alunoSelecionado || abrindo}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              {abrindo ? 'Abrindo janela...' : '🔓 Abrir Janela Complementar'}
            </button>
          </div>

          {/* ── Janelas existentes ──────────────────────────────────────── */}
          {janelas.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Janelas neste encontro
              </p>

              {janelas.map((j) => {
                const prog = progressos[j.id]
                const pct  = prog ? Math.round((prog.jaAvaliaram / Math.max(prog.total, 1)) * 100) : 0

                return (
                  <div key={j.id}
                    className={`rounded-lg border p-3 ${j.aberta ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={j.aberta ? 'text-green-600' : 'text-gray-400'}>
                          {j.aberta ? '🔓' : '🔒'}
                        </span>
                        <p className="text-sm font-semibold text-gray-800">{j.aluno.nome}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        j.aberta
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {j.aberta ? 'Aberta' : 'Fechada'}
                      </span>
                    </div>

                    {/* Progresso */}
                    {prog && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Avaliações recebidas</span>
                          <span className="font-semibold">{prog.jaAvaliaram}/{prog.total}</span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {prog.pendentes.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Faltam: {prog.pendentes.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Ação */}
                    <button
                      onClick={() => alterarJanela(j.id, j.aberta ? 'fechar' : 'reabrir')}
                      className={`w-full text-xs py-1.5 rounded-lg font-medium transition-colors ${
                        j.aberta
                          ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
                          : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {j.aberta ? '🔒 Fechar janela' : '🔓 Reabrir janela'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
