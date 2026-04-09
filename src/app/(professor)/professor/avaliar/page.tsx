'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TopBar } from '@/components/ui/TopBar'
import { useToast } from '@/components/ui/use-toast'
import { getCriterios, getLabelTipo, OPCOES_ATITUDES, TipoEncontroForm, Criterio, CampoNota } from '@/lib/criterios'

// IMPORTAÇÃO DA SERVER ACTION (A Mágica do Next.js 14)
import { salvarAvaliacoesTutor } from './actions'

type Aluno    = { id: string; nome: string }
type NotaAluno = {
  avaliadoId:        string
  c1:                number
  c2:                number
  c3:                number
  atitudes:          number
  ativCompensatoria: boolean
  faltou:            boolean
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

function AvaliarTutorPageInner() {
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

  // O fetch de LEITURA (GET) foi mantido pois consome outras APIs
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
              faltou:            av.faltou ?? false,
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
              const alunosDoModulo: Aluno[] = m.matriculas.map((ma: any) => ma.usuario)

              let visitantes: Aluno[] = []
              try {
                const eeRes  = await fetch(`/api/encontros-especiais/visitantes?problemaId=${problemaId}&tipoEncontro=${tipo}`)
                const eeData = await eeRes.json()
                if (Array.isArray(eeData)) visitantes = eeData
              } catch {}

              const todosIds = new Set(alunosDoModulo.map((a: Aluno) => a.id))
              const visitantesNovos = visitantes.filter((v: Aluno) => !todosIds.has(v.id))
              const todos: Aluno[] = [
                ...alunosDoModulo,
                ...visitantesNovos.map((v: Aluno) => ({ ...v, visitante: true } as any)),
              ]

              setAlunos(todos)
              const init: Record<string, NotaAluno> = {}
              for (const a of todos) {
                init[a.id] = { avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false, faltou: false }
              }
              setNotas(init)
              break
            }
          }
        }
        setCarregando(false)
      })
  }, [problemaId, tipo])

  const setNota = (alunoId: string, campo: CampoNota | 'ativCompensatoria' | 'faltou', valor: number | boolean) => {
    setNotas((prev) => ({ ...prev, [alunoId]: { ...prev[alunoId], [campo]: valor } }))
  }

  // ----------------------------------------------------------------------
  // FUNÇÃO REFEITA: Usando Server Action ao invés de fetch('/api/...', POST)
  // ----------------------------------------------------------------------
  const salvar = async () => {
    setSalvando(true)
    try {
      // Chama a função direto do servidor! Sem conversão JSON.stringify manual.
      const resposta = await salvarAvaliacoesTutor({
        problemaId,
        tipoEncontro: tipo,
        avaliacoes: Object.values(notas)
      })

      // A action retorna um objeto { sucesso, erro, quantidadeSalva }
      if (!resposta.sucesso) {
        throw new Error(resposta.erro || 'Erro desconhecido ao salvar as notas.')
      }

      toast({ title: `Rascunho salvo! ${resposta.quantidadeSalva} alunos avaliados.` })
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const calcMedia = (n: NotaAluno) => ((n.c1 + n.c2 + n.c3) / 3)
  const calcMAt   = (n: NotaAluno) => n.faltou ? '—' : n.ativCompensatoria ? 'SATISFATÓRIO' : (calcMedia(n) - n.atitudes).toFixed(2)

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
      <main className="max-w-5xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1F4E79]">
            {problemaNome || 'Avaliação'} — {labelTipo}
          </h1>

        </div>

        {/* ── MOBILE: cards empilhados ── */}
        <div className="space-y-4 md:hidden">
          {alunos.map((aluno, idx) => {
            const n = notas[aluno.id] ?? { avaliadoId: aluno.id, c1: 0, c2: 0, c3: 0, atitudes: 0, ativCompensatoria: false }
            return (
              <div key={aluno.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-semibold text-sm ${n.faltou ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                    {idx + 1}. {aluno.nome}
                  </span>
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
                        Comp.
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
                    ⚠️ Aluno faltoso — notas interpares deste aluno serão ignoradas no cálculo dos colegas
                  </div>
                )}

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
                  <th className="px-3 py-3 font-medium text-center text-red-300">Faltou</th>
                  <th className