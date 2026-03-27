'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/ui/TopBar'
import { useToast } from '@/components/ui/use-toast'
import { getCriterios, getLabelTipo, OPCOES_ATITUDES, TipoEncontroForm, Criterio, CampoNota } from '@/lib/criterios'

type Aluno     = { id: string; nome: string }
type NotaAluno = { avaliadoId: string; c1: number; c2: number; c3: number; atitudes: number }

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

  const problemaId  = params.get('problemaId') ?? ''
  const tipo        = (params.get('tipo') ?? 'ABERTURA') as TipoEncontroForm
  const nomeProblem = params.get('nome') ?? ''
  // externo=1 quando o aluno foi realocado para outro módulo
  const externo     = params.get('externo') === '1'

  const [alunos,     setAlunos]     = useState<Aluno[]>([])
  const [notas,      setNotas]      = useState<Record<string, NotaAluno>>({})
  const [cardAtual,  setCardAtual]  = useState(0)
  const [fase,       setFase]       = useState<'formulario' | 'revisao' | 'concluido'>('formulario')
  const [carregando, setCarregando] = useState(true)
  const [enviando,   setEnviando]   = useState(false)
  const [moduloInfo, setModuloInfo] = useState<{ nome: string; tutoria: string } | null>(null)

  const criterios = getCriterios(tipo)
  const labelTipo = getLabelTipo(tipo)

  // ── Carrega o grupo de alunos ────────────────────────────────────
  useEffect(() => {
    if (!problemaId || !session) return

    // Verifica se já submeteu
    fetch('/api/avaliacoes/aluno?problemaId=' + problemaId + '&tipoEncontro=' + tipo)
      .then((r) => r.json())
      .then(async (avalData: any) => {

        // ── Busca o grupo completo (matriculados + visitantes) ──────
        // Usa a API de grupo que já inclui visitantes para QUALQUER tipo de acesso
        const grupoRes  = await fetch(
          `/api/encontros-especiais/grupo?problemaId=${problemaId}&tipoEncontro=${tipo}`
        )

        let grupo: Aluno[] = []
        let moduloDestino: { nome: string; tutoria: string } | null = null

        if (grupoRes.ok) {
          const grupoData = await grupoRes.json()
          grupo           = grupoData.grupo ?? []
          moduloDestino   = grupoData.modulo ?? null
        } else {
          // Fallback: aluno está no próprio módulo, busca via /api/modulos
          const modulos: any[] = await fetch('/api/modulos').then((r) => r.json())
          for (const m of modulos) {
            const prob = m.problemas?.find((p: any) => p.id === problemaId)
            if (prob) {
              grupo = m.matriculas.map((ma: any) => ma.usuario)
              break
            }
          }
        }

        if (moduloDestino) setModuloInfo(moduloDestino)

        if (grupo.length === 0) {
          setCarregando(false)
          return
        }

        // Aluno logado sempre primeiro (auto-avaliação no card 1)
        const euMesmo = grupo.find((a) => a.id === session?.user?.id)
        const outros  = grupo.filter((a) => a.id !== session?.user?.id)
        const alunosOrdenados = euMesmo ? [euMesmo, ...outros] : grupo

        if (avalData.submetido) {
          setAlunos(alunosOrdenados)
          // Popula notas já submetidas
          const notasMap: Record<string, NotaAluno> = {}
          for (const a of alunosOrdenados) {
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
          setFase('concluido')
        } else {
          setAlunos(alunosOrdenados)
          const init: Record<string, NotaAluno> = {}
          for (const a of alunosOrdenados) {
            init[a.id] = { avaliadoId: a.id, c1: 0, c2: 0, c3: 0, atitudes: 0 }
          }
          setNotas(init)
        }

        setCarregando(false)
      })
  }, [problemaId, tipo, session])

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

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  // ── Sem alunos ────────────────────────────────────────────────────
  if (alunos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">Encontro não disponível</h1>
          <p className="text-sm text-gray-400">
            O encontro ainda não foi aberto ou você não está alocado neste grupo.
            Verifique com seu professor.
          </p>
        </main>
      </div>
    )
  }

  const alunoAtual = alunos[cardAtual]
  const notaAtual  = notas[alunoAtual?.id] ?? { avaliadoId: '', c1: 0, c2: 0, c3: 0, atitudes: 0 }
  const ehAutoAval = alunoAtual?.id === session?.user?.id

  // ── Concluído ─────────────────────────────────────────────────────
  if (fase === 'concluido') {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" />
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center mb-6">
            <div className="text-5xl mb-3">✅</div>
            <h1 className="text-xl font-bold text-gray-800 mb-1">Avaliação enviada!</h1>
            <p className="text-sm text-gray-500">
              {externo
                ? `Encontro Especial — ${moduloInfo?.nome ?? 'Módulo externo'} · ${moduloInfo?.tutoria ?? ''}`
                : `${labelTipo} · ${nomeProblem}`}
            </p>
          </div>
          <div className="space-y-3">
            {alunos.map((a) => {
              const n = notas[a.id]
              const media = n ? ((n.c1 + n.c2 + n.c3) / 3 - n.atitudes).toFixed(2) : '—'
              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-800 text-sm">{a.nome}</p>
                    {a.id === session?.user?.id && (
                      <span className="text-xs bg-[#1F4E79] text-white px-2 py-0.5 rounded-full">
                        Você
                      </span>
                    )}
                  </div>
                  {n && (
                    <div className="grid grid-cols-5 gap-2 text-xs text-center text-gray-500">
                      {(['c1','c2','c3'] as const).map((c, i) => (
                        <div key={c} className="bg-gray-50 rounded-lg p-2">
                          <p className="font-medium text-gray-400">C{i+1}</p>
                          <p className="font-bold text-gray-700">{Number(n[c]).toFixed(1)}</p>
                        </div>
                      ))}
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="font-medium text-gray-400">At.</p>
                        <p className="font-bold text-gray-700">{Number(n.atitudes).toFixed(1)}</p>
                      </div>
                      <div className="bg-[#1F4E79] bg-opacity-10 rounded-lg p-2">
                        <p className="font-medium text-[#1F4E79]">M-At</p>
                        <p className="font-bold text-[#1F4E79]">{media}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  // ── Revisão ───────────────────────────────────────────────────────
  if (fase === 'revisao') {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" />
        <main className="max-w-lg mx-auto px-4 py-6">
          {externo && moduloInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 text-xs text-amber-700 font-medium">
              🔄 Encontro Especial — {moduloInfo.nome} · {moduloInfo.tutoria}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
            <h2 className="font-bold text-gray-800 mb-1">Revisar antes de enviar</h2>
            <p className="text-xs text-gray-400">{labelTipo} · {nomeProblem}</p>
          </div>
          <div className="space-y-3 mb-6">
            {alunos.map((a) => {
              const n = notas[a.id]
              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-800 text-sm">{a.nome}</p>
                    {a.id === session?.user?.id && (
                      <span className="text-xs bg-[#1F4E79] text-white px-2 py-0.5 rounded-full">Auto</span>
                    )}
                  </div>
                  {n && (
                    <div className="grid grid-cols-4 gap-2 text-xs text-center">
                      {(['c1','c2','c3'] as const).map((c, i) => (
                        <div key={c} className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-400">C{i+1}</p>
                          <p className="font-bold text-gray-700">{Number(n[c]).toFixed(1)}</p>
                        </div>
                      ))}
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-400">At.</p>
                        <p className="font-bold text-gray-700">{Number(n.atitudes).toFixed(1)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setFase('formulario')}
              className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium text-sm hover:bg-gray-50">
              ← Corrigir
            </button>
            <button type="button" onClick={enviar} disabled={enviando}
              className="flex-1 bg-[#1F4E79] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#163d61] disabled:opacity-50">
              {enviando ? 'Enviando...' : '✅ Confirmar Envio'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Formulário ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="ALUNO" backHref="/aluno/dashboard" />
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Badge encontro especial */}
        {externo && moduloInfo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 text-xs text-amber-700 font-medium">
            🔄 Encontro Especial — {moduloInfo.nome} · {moduloInfo.tutoria}
          </div>
        )}

        {/* Cabeçalho */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {labelTipo}
            </span>
            <span className="text-xs text-gray-400">
              {cardAtual + 1} de {alunos.length}
            </span>
          </div>
          <h2 className="font-bold text-gray-800">{alunoAtual?.nome}</h2>
          {ehAutoAval && (
            <p className="text-xs text-[#1F4E79] mt-0.5 font-medium">Auto-avaliação</p>
          )}
          {/* Barra de progresso */}
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1F4E79] rounded-full transition-all"
              style={{ width: `${((cardAtual + 1) / alunos.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Critérios */}
        <div className="space-y-3">
          {criterios.map((criterio: Criterio) => (
            <div key={criterio.campo} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start gap-2 mb-3">
                <span className="shrink-0 bg-[#1F4E79] text-white text-xs font-bold px-2 py-1 rounded-lg mt-0.5">
                  {criterio.label}
                </span>
                <p className="text-sm font-medium text-gray-800 leading-snug">
                  {criterio.nome}
                </p>
              </div>
              <DropdownNota
                valor={notaAtual[criterio.campo as CampoNota] as number}
                opcoes={criterio.opcoes}
                onChange={(v) => setNota(alunoAtual.id, criterio.campo as CampoNota, v)}
              />
            </div>
          ))}

          {/* Atitudes */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-start gap-2 mb-3">
              <span className="shrink-0 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-lg mt-0.5">
                At.
              </span>
              <p className="text-sm font-medium text-gray-800 leading-snug">
                Atitudes — Pontualidade, responsabilidade, postura e comportamento.
              </p>
            </div>
            <DropdownNota
              valor={notaAtual.atitudes}
              opcoes={OPCOES_ATITUDES}
              onChange={(v) => setNota(alunoAtual.id, 'atitudes', v)}
            />
          </div>
        </div>

        {/* Navegação */}
        <div className="mt-6 flex gap-3">
          {cardAtual > 0 && (
            <button type="button" onClick={() => setCardAtual((p) => p - 1)}
              className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium text-sm hover:bg-gray-50">
              ← Anterior
            </button>
          )}
          {cardAtual < alunos.length - 1 ? (
            <button type="button" onClick={() => setCardAtual((p) => p + 1)}
              className="flex-1 bg-[#2E75B6] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#1F4E79]">
              Próximo →
            </button>
          ) : (
            <button type="button" onClick={() => setFase('revisao')}
              className="flex-1 bg-[#1F4E79] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#163d61]">
              Revisar →
            </button>
          )}
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
