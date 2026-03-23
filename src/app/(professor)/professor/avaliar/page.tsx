'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TopBar } from '@/components/ui/TopBar'
import { useToast } from '@/components/ui/use-toast'
import { getCriterios, getLabelTipo, OPCOES_ATITUDES, TipoEncontroForm, Criterio, CampoNota } from '@/lib/criterios'

type Aluno    = { id: string; nome: string }
type NotaAluno = {
  avaliadoId:        string
  c1:                number
  c2:                number
  c3:                number
  atitudes:          number
  ativCompensatoria: boolean
}

// Dropdown reutilizável para notas
function DropdownNota({
  valor,
  opcoes,
  onChange,
  disabled = false,
  label,
}: {
  valor:    number
  opcoes:   number[]
  onChange: (v: number) => void
  disabled?: boolean
  label?:   string
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

export default function AvaliarTutorPage() {
  const { data: session } = useSession()
  const searchParams      = useSearchParams()
  const router            = useRouter()
  const { toast }         = useToast()

  const problemaId  = searchParams.get('problemaId') ?? ''
  const tipo        = (searchParams.get('tipo') ?? 'ABERTURA') as TipoEncontroForm
  const problemaNome = searchParams.get('nome') ?? ''

  const [alunos,     setAlunos]     = useState<Aluno[]>([])
  const [notas,      setNotas]      = useState<Record<string, NotaAluno>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando,   setSalvando]   = useState(false)

  const criterios = getCriterios(tipo)
  const labelTipo = getLabelTipo(tipo)

  useEffect(() => {
    if (!problemaId) return
    fetch('/api/avaliacoes/tutor?problemaId=' + problemaId + '&tipoEncontro=' + tipo)
      .then((r) => r.json())
      .then(async (data: any[]) => {
        if (data.length > 0) {
          const notasMap: Record<string, NotaAluno> = {}
          const alunosArr: Aluno[] = []
          for (const av of data) {
            notasMap[av.avaliadoId] = {
              avaliadoId: av.avaliadoId,
              c1: Number(av.c1), c2: Number(av.c2), c3: Number(av.c3),
              atitudes: Number(av.atitudes),
              ativCompensatoria: av.ativCompensatoria,
            }
            alunosArr.push(av.avaliado)
          }
          setAlunos(alunosArr)
          setNotas(notasMap)
        } else {
          const modulos: any[] = await fetch('/api/modulos').then((r) => r.json())
          for (const m of modulos) {
            const prob = m.problemas?.find((p: any) => p.id === problemaId)
            if (prob) {
              // Ordem garantida: API já retorna por numeraNaTurma asc
              const alunosDoModulo: Aluno[] = m.matriculas.map((ma: any) => ma.usuario)
              setAlunos(alunosDoModulo)
              const init: Record<string, NotaAluno> = {}
              for (const a of alunosDoModulo) {
                init[a.id] = { avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false }
              }
              setNotas(init)
              break
            }
          }
        }
        setCarregando(false)
      })
  }, [problemaId, tipo])

  const setNota = (alunoId: string, campo: CampoNota | 'ativCompensatoria', valor: number | boolean) => {
    setNotas((prev) => ({ ...prev, [alunoId]: { ...prev[alunoId], [campo]: valor } }))
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch('/api/avaliacoes/tutor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // finalizar=false: professor pode sempre modificar as notas posteriormente
        body:    JSON.stringify({ problemaId, tipoEncontro: tipo, avaliacoes: Object.values(notas) }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: 'Notas salvas com sucesso' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const calcMedia = (n: NotaAluno) => ((n.c1 + n.c2 + n.c3) / 3)
  const calcMAt   = (n: NotaAluno) => n.ativCompensatoria ? 'SATISFATÓRIO' : (calcMedia(n) - n.atitudes).toFixed(2)

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
      <main className="max-w-5xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1F4E79]">
            {problemaNome || 'Avaliacao'} — {labelTipo}
          </h1>

        </div>

        {/* ── MOBILE: cards empilhados ── */}
        <div className="space-y-4 md:hidden">
          {alunos.map((aluno, idx) => {
            const n = notas[aluno.id] ?? { avaliadoId: aluno.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false }
            return (
              <div key={aluno.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-800 text-sm">{idx + 1}. {aluno.nome}</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={n.ativCompensatoria}
                      onChange={(e) => setNota(aluno.id, 'ativCompensatoria', e.target.checked)}
                       className="w-4 h-4" />
                    Comp.
                  </label>
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
                        disabled={n.ativCompensatoria}
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
                      disabled={n.ativCompensatoria}
                      label="Atitudes"
                    />
                  </div>
                </div>

                <div className="mt-3 text-right text-xs text-gray-500">
                  M = {calcMedia(n).toFixed(2)} · M−At = <span className="font-bold text-[#1F4E79]">{calcMAt(n)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── DESKTOP: tabela ── */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1F4E79] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-medium min-w-[180px]">Aluno</th>
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
                  <th className="px-3 py-3 font-medium text-center">Comp.</th>
                  <th className="px-3 py-3 font-medium text-center">M−At</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno, idx) => {
                  const n = notas[aluno.id] ?? { avaliadoId: aluno.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false }
                  return (
                    <tr key={aluno.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium text-gray-800">{aluno.nome}</td>

                      {criterios.map((c) => (
                        <td key={c.campo} className="px-2 py-2">
                          <DropdownNota
                            valor={n[c.campo] as number}
                            opcoes={c.opcoes}
                            onChange={(v) => setNota(aluno.id, c.campo, v)}
                            disabled={n.ativCompensatoria}
                            label={c.nome}
                          />
                        </td>
                      ))}

                      <td className="px-2 py-2">
                        <DropdownNota
                          valor={n.atitudes}
                          opcoes={OPCOES_ATITUDES}
                          onChange={(v) => setNota(aluno.id, 'atitudes', v)}
                          disabled={n.ativCompensatoria}
                          label="Atitudes"
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={n.ativCompensatoria}
                          onChange={(e) => setNota(aluno.id, 'ativCompensatoria', e.target.checked)}
                           className="w-4 h-4 cursor-pointer" />
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
          <button onClick={() => salvar()} disabled={salvando}
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
