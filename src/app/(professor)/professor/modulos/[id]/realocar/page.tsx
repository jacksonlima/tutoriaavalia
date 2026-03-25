'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TopBar } from '@/components/ui/TopBar'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'

type Aluno         = { id: string; nome: string; email: string }
type Problema      = { id: string; numero: number; nome: string | null; temSaltoTriplo: boolean }
type ModuloDestino = { id: string; nome: string; tutoria: string; turma: string; tutor: { nome: string }; problemas: Problema[] }

type Alocacao = {
  alunoId:           string
  tipoEncontro:      string
  problemaDestinoId: string
}

type EEExistente = {
  id:               string
  alunoId:          string
  tipoEncontro:     string
  observacao:       string | null
  aluno:            Aluno
  problemaDestino:  { id: string; numero: number; nome: string | null; modulo: { nome: string; tutoria: string; turma: string; tutor: { nome: string } } }
}

const TIPOS = [
  { value: 'ABERTURA',    label: 'Abertura' },
  { value: 'FECHAMENTO',  label: 'Fechamento' },
  { value: 'FECHAMENTO_A', label: 'Fechamento A (ST)' },
  { value: 'FECHAMENTO_B', label: 'Fechamento B (ST)' },
]

function RealocarPage() {
  const params  = useParams()
  const router  = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const moduloId = params.id as string

  const [modulo,        setModulo]        = useState<any>(null)
  const [alunos,        setAlunos]        = useState<Aluno[]>([])
  const [modulosAtivos, setModulosAtivos] = useState<ModuloDestino[]>([])
  const [existentes,    setExistentes]    = useState<EEExistente[]>([])
  const [carregando,    setCarregando]    = useState(true)

  // Mapa de alocações pendentes: chave = "alunoId|tipoEncontro"
  const [alocacoes,   setAlocacoes]   = useState<Record<string, Alocacao>>({})
  const [observacao,  setObservacao]  = useState('')
  const [salvando,    setSalvando]    = useState(false)

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch(`/api/modulos/${moduloId}`).then((r) => r.json()),
      fetch('/api/modulos/ativos').then((r) => r.json()),
      fetch(`/api/encontros-especiais?moduloId=${moduloId}`).then((r) => r.json()),
    ]).then(([mod, mods, ees]) => {
      setModulo(mod)
      const alunosList: Aluno[] = (mod.matriculas ?? []).map((m: any) => m.usuario)
      setAlunos(alunosList)
      setModulosAtivos(Array.isArray(mods) ? mods.filter((m: any) => m.id !== moduloId) : [])
      setExistentes(Array.isArray(ees) ? ees : [])
      setCarregando(false)
    })
  }, [session, moduloId])

  const chave = (alunoId: string, tipo: string) => `${alunoId}|${tipo}`

  const setAlocacao = (alunoId: string, tipo: string, problemaDestinoId: string) => {
    const k = chave(alunoId, tipo)
    if (!problemaDestinoId) {
      setAlocacoes((prev) => { const n = { ...prev }; delete n[k]; return n })
    } else {
      setAlocacoes((prev) => ({ ...prev, [k]: { alunoId, tipoEncontro: tipo, problemaDestinoId } }))
    }
  }

  const salvar = async () => {
    const lista = Object.values(alocacoes)
    if (lista.length === 0) { toast({ title: 'Nenhuma alocação configurada', variant: 'destructive' }); return }
    setSalvando(true)
    try {
      const res  = await fetch('/api/encontros-especiais', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ moduloOrigemId: moduloId, observacao, alocacoes: lista }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: data.error, variant: 'destructive' }); return }
      setExistentes((prev) => {
        const novos = Array.isArray(data) ? data : [data]
        const semDup = prev.filter((e) => !novos.some(
          (n: EEExistente) => n.alunoId === e.alunoId && n.tipoEncontro === e.tipoEncontro
        ))
        return [...semDup, ...novos]
      })
      setAlocacoes({})
      setObservacao('')
      toast({ title: `✅ ${lista.length} alocação(ões) salva(s)` })
    } finally { setSalvando(false) }
  }

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

  const tiposParaProb = (prob: Problema) => {
    if (!prob) return TIPOS
    return prob.temSaltoTriplo
      ? TIPOS.filter((t) => t.value !== 'FECHAMENTO')
      : TIPOS.filter((t) => t.value !== 'FECHAMENTO_A' && t.value !== 'FECHAMENTO_B')
  }

  const pendentes = Object.values(alocacoes).length

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref={`/professor/dashboard`} />
      <Toaster />

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* Cabeçalho */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#1F4E79]">🔄 Encontros Especiais</h1>
          <p className="text-sm text-gray-500 mt-1">
            {modulo?.nome} · {modulo?.tutoria} · Turma {modulo?.turma}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Redistribua os alunos temporariamente para outros professores. As notas serão calculadas
            automaticamente na nota formativa deste módulo.
          </p>
        </div>

        {/* Alocações existentes */}
        {existentes.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Alocações ativas ({existentes.length})
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Aluno</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Destino</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {existentes.map((ee) => {
                    const tipoLabel = TIPOS.find((t) => t.value === ee.tipoEncontro)?.label ?? ee.tipoEncontro
                    const dest      = ee.problemaDestino
                    return (
                      <tr key={ee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{ee.aluno.nome}</p>
                          <p className="text-xs text-gray-400">{ee.aluno.email}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            {tipoLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-gray-700">
                            {dest.modulo.nome} · P{dest.numero}{dest.nome ? ` — ${dest.nome}` : ''}
                          </p>
                          <p className="text-xs text-gray-400">
                            Prof. {dest.modulo.tutor.nome} · {dest.modulo.tutoria} · Turma {dest.modulo.turma}
                          </p>
                          {ee.observacao && <p className="text-xs text-gray-400 italic mt-0.5">{ee.observacao}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => remover(ee.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Formulário de nova realocação */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Nova realocação
          </h2>

          {/* Observação geral */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Motivo / Observação (aplicado a todas as alocações abaixo):
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Falta do professor por motivo de saúde — 15/04/2025"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
            />
          </div>

          {/* Tabela de alunos × tipos de encontro */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-[#1F4E79] px-4 py-3">
              <p className="text-white text-sm font-semibold">
                Para cada aluno, selecione o módulo e problema de destino
              </p>
              <p className="text-blue-200 text-xs mt-0.5">
                Deixe em branco os encontros que não serão realocados.
                Pesos: Prof. × 4 · Interpares × 0,5 · Auto-aval × 0,5
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {alunos.map((aluno, idx) => {
                const tiposAtivos = TIPOS  // all types selectable; destination problem determines valid types
                return (
                  <div key={aluno.id} className={`px-4 py-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <p className="text-sm font-semibold text-gray-800 mb-3">
                      {String(idx + 1).padStart(2, '0')}. {aluno.nome}
                    </p>

                    <div className="grid gap-3">
                      {TIPOS.map((tipo) => {
                        const k       = chave(aluno.id, tipo.value)
                        const alocado = alocacoes[k]
                        const eeDest  = existentes.find(
                          (e) => e.alunoId === aluno.id && e.tipoEncontro === tipo.value
                        )

                        // If already allocated, show a badge instead
                        if (eeDest) {
                          return (
                            <div key={tipo.value} className="flex items-center gap-3">
                              <span className="text-xs font-medium text-gray-500 w-24 shrink-0">{tipo.label}:</span>
                              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                ✓ Já alocado → {eeDest.problemaDestino.modulo.nome} P{eeDest.problemaDestino.numero}
                              </span>
                            </div>
                          )
                        }

                        return (
                          <div key={tipo.value} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-500 w-24 shrink-0">{tipo.label}:</span>

                            {/* Módulo destino */}
                            <select
                              value={alocado ? modulosAtivos.find((m) => m.problemas.some((p) => p.id === alocado.problemaDestinoId))?.id ?? '' : ''}
                              onChange={(e) => {
                                if (!e.target.value) setAlocacao(aluno.id, tipo.value, '')
                                // reset problema when module changes
                                setAlocacao(aluno.id, tipo.value, '')
                                // store temporarily - user still needs to pick problema
                              }}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4E79] min-w-0 flex-1 max-w-xs"
                            >
                              <option value="">— Módulo destino —</option>
                              {modulosAtivos.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nome} · {m.tutoria} · {m.turma} · Prof. {m.tutor.nome}
                                </option>
                              ))}
                            </select>

                            {/* Problema destino (depende do módulo) */}
                            <AlocacaoSelect
                              aluno={aluno}
                              tipoValue={tipo.value}
                              modulosAtivos={modulosAtivos}
                              alocado={alocado}
                              onSelect={(problemaId) => setAlocacao(aluno.id, tipo.value, problemaId)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Botão salvar */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {pendentes > 0
                ? `${pendentes} alocação(ões) pendente(s) para salvar`
                : 'Configure as alocações acima'}
            </p>
            <button
              type="button"
              disabled={salvando || pendentes === 0}
              onClick={salvar}
              className="bg-[#1F4E79] hover:bg-[#163d61] text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {salvando ? 'Salvando...' : `💾 Salvar ${pendentes > 0 ? `(${pendentes})` : ''}`}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-componente: seletor de módulo + problema em cascata
// ─────────────────────────────────────────────────────────────────
function AlocacaoSelect({
  aluno, tipoValue, modulosAtivos, alocado, onSelect,
}: {
  aluno:         Aluno
  tipoValue:     string
  modulosAtivos: ModuloDestino[]
  alocado?:      Alocacao
  onSelect:      (problemaId: string) => void
}) {
  const [moduloSel, setModuloSel] = useState('')
  const problemas = modulosAtivos.find((m) => m.id === moduloSel)?.problemas ?? []

  const tiposValidos = (prob: Problema) => {
    if (prob.temSaltoTriplo) return ['ABERTURA', 'FECHAMENTO_A', 'FECHAMENTO_B']
    return ['ABERTURA', 'FECHAMENTO']
  }

  return (
    <div className="flex items-center gap-2 flex-wrap flex-1">
      {/* Módulo */}
      <select
        value={moduloSel}
        onChange={(e) => { setModuloSel(e.target.value); onSelect('') }}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4E79] flex-1 min-w-32 max-w-xs"
      >
        <option value="">— Módulo —</option>
        {modulosAtivos.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome} · Prof. {m.tutor.nome}
          </option>
        ))}
      </select>

      {/* Problema */}
      {moduloSel && (
        <select
          value={alocado?.problemaDestinoId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4E79] flex-1 min-w-40"
        >
          <option value="">— Problema —</option>
          {problemas
            .filter((p) => tiposValidos(p).includes(tipoValue))
            .map((p) => (
              <option key={p.id} value={p.id}>
                P{String(p.numero).padStart(2, '0')}{p.nome ? ` — ${p.nome}` : ''}
                {p.temSaltoTriplo ? ' (ST)' : ''}
              </option>
            ))}
        </select>
      )}

      {alocado?.problemaDestinoId && (
        <span className="text-green-600 text-xs font-medium">✓</span>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RealocarPage />
    </Suspense>
  )
}
