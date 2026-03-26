'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TopBar } from '@/components/ui/TopBar'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
type Aluno         = { id: string; nome: string; email: string }
type Problema      = { id: string; numero: number; nome: string | null; temSaltoTriplo: boolean }
type TutoriaPar    = {
  id:       string
  tutoria:  string
  tutor:    { id: string; nome: string; email: string }
  problemas: Problema[]
}

type Alocacao = {
  alunoId:           string
  problemaDestinoId: string
  tipoEncontro:      string
}

type EEExistente = {
  id:           string
  alunoId:      string
  tipoEncontro: string
  observacao:   string | null
  aluno:        Aluno
  problemaDestino: {
    id:     string
    numero: number
    nome:   string | null
    modulo: { nome: string; tutoria: string; turma: string; tutor: { nome: string } }
  }
}

const TIPO_LABEL: Record<string, string> = {
  ABERTURA:    'Abertura',
  FECHAMENTO:  'Fechamento',
  FECHAMENTO_A:'Fechamento A (ST)',
  FECHAMENTO_B:'Fechamento B (ST)',
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const tiposParaProblema = (prob: Problema) =>
  prob.temSaltoTriplo
    ? ['ABERTURA', 'FECHAMENTO_A', 'FECHAMENTO_B']
    : ['ABERTURA', 'FECHAMENTO']

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────
function RealocarPageInner() {
  const params  = useParams()
  const { data: session } = useSession()
  const { toast } = useToast()
  const moduloId = params.id as string

  const [modulo,       setModulo]       = useState<any>(null)
  const [alunos,       setAlunos]       = useState<Aluno[]>([])
  const [tutoriasPares, setTutoriasPares] = useState<TutoriaPar[]>([])
  const [existentes,   setExistentes]   = useState<EEExistente[]>([])
  const [carregando,   setCarregando]   = useState(true)

  // Alocações pendentes: chave = "alunoId|tipoEncontro"
  type AlocKey = `${string}|${string}`
  const [alocacoes,  setAlocacoes]  = useState<Record<AlocKey, Alocacao>>({})
  const [observacao, setObservacao] = useState('')
  const [salvando,   setSalvando]   = useState(false)

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch(`/api/modulos/${moduloId}`).then((r) => r.json()),
      fetch(`/api/modulos/mesmo-modulo?moduloId=${moduloId}`).then((r) => r.json()),
      fetch(`/api/encontros-especiais?moduloId=${moduloId}`).then((r) => r.json()),
    ]).then(([mod, pares, ees]) => {
      setModulo(mod)
      setAlunos((mod.matrículas ?? []).map((m: any) => m.usuario))
      setTutoriasPares(Array.isArray(pares) ? pares : [])
      setExistentes(Array.isArray(ees) ? ees : [])
      setCarregando(false)
    })
  }, [session, moduloId])

  // ── Alocação helpers ────────────────────────────────────────────
  const chave = (alunoId: string, tipo: string): AlocKey =>
    `${alunoId}|${tipo}` as AlocKey

  const setAlocacao = (
    alunoId: string,
    tipo: string,
    tutoriaId: string,
    problemaId: string
  ) => {
    const k = chave(alunoId, tipo)
    if (!tutoriaId || !problemaId) {
      setAlocacoes((prev) => { const n = { ...prev }; delete n[k]; return n })
    } else {
      setAlocacoes((prev) => ({
        ...prev,
        [k]: { alunoId, tipoEncontro: tipo, problemaDestinoId: problemaId },
      }))
    }
  }

  // ── Salvar ───────────────────────────────────────────────────────
  const salvar = async () => {
    const lista = Object.values(alocacoes)
    if (lista.length === 0) {
      toast({ title: 'Configure ao menos uma alocação', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/encontros-especiais', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ moduloOrigemId: moduloId, observacao, alocacoes: lista }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
        return
      }
      const novos: EEExistente[] = Array.isArray(data) ? data : [data]
      setExistentes((prev) => {
        const semDup = prev.filter(
          (e) => !novos.some(
            (n) => n.alunoId === e.alunoId && n.tipoEncontro === e.tipoEncontro
          )
        )
        return [...semDup, ...novos]
      })
      setAlocacoes({})
      setObservacao('')
      toast({ title: `✅ ${lista.length} alocação(ões) salva(s)` })
    } finally {
      setSalvando(false)
    }
  }

  // ── Remover ──────────────────────────────────────────────────────
  const remover = async (id: string) => {
    const res = await fetch('/api/encontros-especiais', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ encontroEspecialId: id }),
    })
    if (res.ok) {
      setExistentes((prev) => prev.filter((e) => e.id !== id))
      toast({ title: 'Alocação removida' })
    }
  }

  const pendentes = Object.values(alocacoes).length

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Sem tutorias parceiras = módulo isolado ──────────────────────
  if (tutoriasPares.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" />
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">
            Nenhuma tutoria parceira encontrada
          </h1>
          <p className="text-sm text-gray-400">
            Para realocar alunos, é necessário que existam outros professores
            cadastrados no mesmo módulo (<strong>{modulo?.nome}</strong> · {modulo?.turma} · {modulo?.ano}).
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Verifique se os demais professores criaram seus módulos com o mesmo
            nome, turma e ano.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" />
      <Toaster />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Cabeçalho ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h1 className="text-xl font-bold text-[#1F4E79] mb-1">
            🔄 Encontros Especiais
          </h1>
          <p className="text-sm font-medium text-gray-700">
            {modulo?.nome}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {modulo?.tutoria} · Turma {modulo?.turma} · {modulo?.ano} · {alunos.length} alunos
          </p>
          <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">
            Redistribua seus alunos entre os outros professores <strong>deste mesmo módulo</strong>.
            As notas serão calculadas automaticamente na nota formativa de cada aluno.
            <br />
            <span className="font-medium text-[#1F4E79]">
              Pesos: Professor × 4 · Avaliação Interpares × 0,5 · Auto-avaliação × 0,5
            </span>
          </p>
        </div>

        {/* ── Professores disponíveis ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Professores disponíveis neste módulo ({tutoriasPares.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {tutoriasPares.map((t) => (
              <span key={t.id}
                className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-1.5 rounded-full font-medium">
                {t.tutoria} — Prof. {t.tutor.nome}
              </span>
            ))}
          </div>
        </div>

        {/* ── Alocações existentes ── */}
        {existentes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                Alocações ativas ({existentes.length})
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 w-1/4">Aluno</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 w-1/6">Encontro</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Destino</th>
                  <th className="px-4 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {existentes.map((ee) => {
                  const dest = ee.problemaDestino
                  return (
                    <tr key={ee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800 text-xs">{ee.aluno.nome}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {TIPO_LABEL[ee.tipoEncontro] ?? ee.tipoEncontro}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-gray-700">
                          Prof. {dest.modulo.tutor.nome} · {dest.modulo.tutoria}
                        </p>
                        <p className="text-xs text-gray-400">
                          P{String(dest.numero).padStart(2,'0')}{dest.nome ? ` — ${dest.nome}` : ''}
                        </p>
                        {ee.observacao && (
                          <p className="text-xs text-gray-400 italic mt-0.5">{ee.observacao}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" onClick={() => remover(ee.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                          Remover
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Nova realocação ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-[#1F4E79] px-4 py-3">
            <h2 className="text-white text-sm font-semibold">
              Nova realocação — {alunos.length} alunos × tipos de encontro
            </h2>
            <p className="text-blue-200 text-xs mt-0.5">
              Para cada linha, selecione o professor destino e o problema específico.
              Deixe em branco os encontros que não precisam de realocação.
            </p>
          </div>

          {/* Observação */}
          <div className="px-4 pt-4 pb-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Motivo / Observação:
            </label>
            <input type="text" value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Falta do professor por motivo de saúde — 15/04/2025"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
            />
          </div>

          {/* Tabela alunos */}
          <div className="divide-y divide-gray-100 px-4 pb-4">
            {alunos.map((aluno, idx) => {
              // Tipos de encontro disponíveis são baseados nos problemas do próprio módulo
              const todosOsTipos = modulo?.problemas?.reduce(
                (acc: string[], prob: Problema) => {
                  tiposParaProblema(prob).forEach((t) => {
                    if (!acc.includes(t)) acc.push(t)
                  })
                  return acc
                }, [] as string[]
              ) ?? ['ABERTURA', 'FECHAMENTO']

              return (
                <div key={aluno.id} className="py-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded font-mono">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {aluno.nome}
                    <span className="text-xs text-gray-400 font-normal">{aluno.email}</span>
                  </p>

                  <div className="space-y-2 pl-8">
                    {todosOsTipos.map((tipo) => {
                      const jaAlocado = existentes.find(
                        (e) => e.alunoId === aluno.id && e.tipoEncontro === tipo
                      )
                      const k        = chave(aluno.id, tipo)
                      const alocado  = alocacoes[k]

                      if (jaAlocado) {
                        return (
                          <div key={tipo} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-400 w-28 shrink-0">
                              {TIPO_LABEL[tipo]}:
                            </span>
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                              ✓ {jaAlocado.problemaDestino.modulo.tutor.nome} · P{jaAlocado.problemaDestino.numero}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div key={tipo} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-500 w-28 shrink-0">
                            {TIPO_LABEL[tipo]}:
                          </span>
                          <CascadeSelect
                            tutoriasPares={tutoriasPares}
                            tipo={tipo}
                            value={alocado?.problemaDestinoId ?? ''}
                            onSelect={(tutoriaId, problemaId) =>
                              setAlocacao(aluno.id, tipo, tutoriaId, problemaId)
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botão salvar */}
          <div className="px-4 pb-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              {pendentes > 0
                ? `${pendentes} alocação(ões) configurada(s) para salvar`
                : 'Nenhuma alocação pendente'}
            </p>
            <button type="button" disabled={salvando || pendentes === 0} onClick={salvar}
              className="bg-[#1F4E79] hover:bg-[#163d61] text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
              {salvando ? 'Salvando...' : `💾 Salvar${pendentes > 0 ? ` (${pendentes})` : ''}`}
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Seletor cascata: Tutoria → Problema
// ─────────────────────────────────────────────────────────────────
function CascadeSelect({
  tutoriasPares, tipo, value, onSelect,
}: {
  tutoriasPares: TutoriaPar[]
  tipo:          string
  value:         string
  onSelect:      (tutoriaId: string, problemaId: string) => void
}) {
  const [tutoriaSel, setTutoriaSel] = useState('')
  const tutoria    = tutoriasPares.find((t) => t.id === tutoriaSel)
  const problemas  = (tutoria?.problemas ?? []).filter((p) =>
    tiposParaProblema(p).includes(tipo)
  )

  return (
    <div className="flex items-center gap-2 flex-1 flex-wrap">
      {/* Tutoria (Professor) */}
      <select value={tutoriaSel}
        onChange={(e) => { setTutoriaSel(e.target.value); onSelect(e.target.value, '') }}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4E79] min-w-48"
      >
        <option value="">— Professor destino —</option>
        {tutoriasPares.map((t) => (
          <option key={t.id} value={t.id}>
            Prof. {t.tutor.nome} · {t.tutoria}
          </option>
        ))}
      </select>

      {/* Problema */}
      {tutoriaSel && (
        <select value={value}
          onChange={(e) => onSelect(tutoriaSel, e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4E79] min-w-40"
        >
          <option value="">— Problema —</option>
          {problemas.map((p) => (
            <option key={p.id} value={p.id}>
              P{String(p.numero).padStart(2,'0')}{p.nome ? ` — ${p.nome}` : ''}
              {p.temSaltoTriplo ? ' (ST)' : ''}
            </option>
          ))}
        </select>
      )}

      {value && <span className="text-green-600 text-sm">✓</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Export com Suspense
// ─────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RealocarPageInner />
    </Suspense>
  )
}
