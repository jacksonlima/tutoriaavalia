'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { useContadorSubmissoes } from '@/hooks/useContadorSubmissoes'

type Problema = {
  id: string
  numero: number
  nome: string | null
  aberturaAtiva: boolean
  fechamentoAtivo: boolean
  temSaltoTriplo: boolean
  fechamentoAAtivo: boolean
  fechamentoBAtivo: boolean
  _count?: { avaliacoesTutor: number; avaliacoesAluno: number }
}

type CoTutorPermItem = { id: string; problemaId: string; tipoEncontro: string }
type CoTutorItem = {
  id: string
  tutorId: string
  tutor: { nome: string; email: string }
  problemas?: { id: string; numero: number; nome: string | null }[]
}

// Resultado da busca de professor
type ProfResult = { id: string; nome: string; email: string }

type ModuloCardProps = {
  modulo: {
    id: string
    nome: string
    ano: number
    turma: string
    tutoria: string
    ativo: boolean
    arquivado: boolean
    problemas: Problema[]
    _count: { matriculas: number }
    tutor?: { nome: string }
  }
  isTitular: boolean
}

export function ModuloCard({ modulo, isTitular }: ModuloCardProps) {
  const [problemas, setProblemas] = useState(modulo.problemas)

  const temAvaliacoes = problemas.some(
    (p) => (p._count?.avaliacoesTutor ?? 0) > 0 || (p._count?.avaliacoesAluno ?? 0) > 0,
  )

  const [expandido,   setExpandido]   = useState(false)
  const [confirmando, setConfirmando] = useState<'excluir' | 'arquivar' | null>(null)
  const [processando, setProcessando] = useState(false)

  // Co-tutores
  const [coTutores,   setCoTutores]   = useState<CoTutorItem[]>([])
  const [gerenciando, setGerenciando] = useState(false)

  // ── Autocomplete de professor (substitui o campo de email) ────────────────
  const [buscaProf,    setBuscaProf]    = useState('')
  const [resultadosProf, setResultadosProf] = useState<ProfResult[]>([])
  const [buscandoProf, setBuscandoProf] = useState(false)
  const [profSelecionado, setProfSelecionado] = useState<ProfResult | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Busca professores conforme o usuário digita
  useEffect(() => {
    if (buscaProf.length < 2) { setResultadosProf([]); return }
    if (profSelecionado) return // já selecionou, não busca mais

    const timer = setTimeout(async () => {
      setBuscandoProf(true)
      try {
        const res  = await fetch(
          `/api/usuarios/buscar?q=${encodeURIComponent(buscaProf)}&papel=TUTOR`
        )
        if (res.ok) {
          const data = await res.json()
          setResultadosProf(Array.isArray(data) ? data : [])
        }
      } catch {}
      finally { setBuscandoProf(false) }
    }, 300)

    return () => clearTimeout(timer)
  }, [buscaProf, profSelecionado])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setResultadosProf([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selecionarProf = (prof: ProfResult) => {
    setProfSelecionado(prof)
    setBuscaProf(prof.nome)
    setResultadosProf([])
    setPermsWizard([])
    setPasso('permissoes')
  }

  const limparSelecao = () => {
    setProfSelecionado(null)
    setBuscaProf('')
    setResultadosProf([])
    setPasso('busca')
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [passo,       setPasso]       = useState<'busca' | 'permissoes'>('busca')
  const [permsWizard, setPermsWizard] = useState<{problemaId:string;tipoEncontro:string}[]>([])
  const [salvando,    setSalvando]    = useState(false)

  // Edição inline de permissões
  const [editandoId, setEditandoId] = useState<string|null>(null)
  const [permsEdit,  setPermsEdit]  = useState<{problemaId:string;tipoEncontro:string}[]>([])

  // Situações Excepcionais
  const [gerEE,        setGerEE]        = useState(false)
  const [encontrosEsp, setEncontrosEsp] = useState<any[]>([])
  const [eeAlunos,     setEeAlunos]     = useState<string[]>([])
  const [eeModDest,    setEeModDest]    = useState('')
  const [eeProblema,   setEeProblema]   = useState('')
  const [eeTipo,       setEeTipo]       = useState('')
  const [eeObs,        setEeObs]        = useState('')
  const [modulosAtivos, setModulosAtivos] = useState<any[]>([])
  const [salvandoEE,   setSalvandoEE]   = useState(false)

  const { toast }  = useToast()
  const router     = useRouter()
  const { getContador } = useContadorSubmissoes(modulo.id, expandido)

  const toggleEncontro = async (
    problemaId: string,
    tipo: 'ABERTURA' | 'FECHAMENTO' | 'FECHAMENTO_A' | 'FECHAMENTO_B',
    ativo: boolean
  ) => {
    const res = await fetch('/api/problemas', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ problemaId, tipoEncontro: tipo, ativo }),
    })
    if (res.ok) {
      setProblemas((prev) =>
        prev.map((p) => {
          if (p.id !== problemaId) return p
          switch (tipo) {
            case 'ABERTURA':     return { ...p, aberturaAtiva:    ativo }
            case 'FECHAMENTO':   return { ...p, fechamentoAtivo:  ativo }
            case 'FECHAMENTO_A': return { ...p, fechamentoAAtivo: ativo }
            case 'FECHAMENTO_B': return { ...p, fechamentoBAtivo: ativo }
          }
        })
      )
      const labels: Record<string, string> = {
        ABERTURA: 'Abertura', FECHAMENTO: 'Fechamento',
        FECHAMENTO_A: 'Fechamento A', FECHAMENTO_B: 'Fechamento B',
      }
      toast({ title: `${labels[tipo]} ${ativo ? 'ativado' : 'desativado'}` })
    }
  }

  const executarAcao = async (acao: 'excluir' | 'arquivar') => {
    setProcessando(true)
    try {
      const res = await fetch(`/api/modulos/${modulo.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ acao }),
      })
      if (!res.ok) {
        const json = await res.json()
        if (res.status === 409 && json.temAvaliacoes) {
          toast({ title: 'Exclusão bloqueada', description: json.error, variant: 'destructive' })
          setConfirmando(null)
          return
        }
        throw new Error(json.error ?? 'Erro ao executar ação')
      }
      toast({ title: acao === 'excluir' ? 'Módulo excluído' : 'Módulo arquivado' })
      router.refresh()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setProcessando(false)
      setConfirmando(null)
    }
  }

  const Toggle = ({ ativo, onChange }: { ativo: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange() }}
      title={ativo ? 'Clique para desativar' : 'Clique para ativar'}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${ativo ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ativo ? 'translate-x-4' : ''}`} />
    </button>
  )

  const tiposDisponiveis = (prob: Problema) => {
    const tipos: {value:string; label:string}[] = [
      { value: 'ABERTURA', label: 'Abertura' },
    ]
    if (prob.temSaltoTriplo) {
      tipos.push(
        { value: 'FECHAMENTO_A', label: 'Fechamento A (ST)' },
        { value: 'FECHAMENTO_B', label: 'Fechamento B (ST)' },
      )
    } else {
      tipos.push({ value: 'FECHAMENTO', label: 'Fechamento' })
    }
    return tipos
  }

  const togglePerm = (
    list: {problemaId:string;tipoEncontro:string}[],
    setList: (v:any)=>void,
    problemaId: string,
    tipoEncontro: string
  ) => {
    const key = `${problemaId}|${tipoEncontro}`
    const exists = list.some(p => `${p.problemaId}|${p.tipoEncontro}` === key)
    if (exists) setList(list.filter(p => `${p.problemaId}|${p.tipoEncontro}` !== key))
    else        setList([...list, { problemaId, tipoEncontro }])
  }

  const handleExpandir = async () => {
    const novo = !expandido
    setExpandido(novo)
    if (novo && isTitular && coTutores.length === 0) {
      try {
        const res  = await fetch(`/api/co-tutores?moduloId=${modulo.id}`)
        const data = await res.json()
        if (Array.isArray(data)) setCoTutores(data)
      } catch {}
    }
  }

  // ── Salva co-tutor com as permissões selecionadas ────────────────────────
  const salvarSubstituto = async () => {
    if (!profSelecionado) return
    if (permsWizard.length === 0) {
      toast({ title: 'Selecione ao menos uma permissão', variant: 'destructive' }); return
    }
    setSalvando(true)
    try {
      // API espera tutorId + problemasIds (ids dos problemas com permissão)
      const problemasIds = [...new Set(permsWizard.map(p => p.problemaId))]
      const res  = await fetch('/api/co-tutores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          moduloId:    modulo.id,
          tutorId:     profSelecionado.id,
          problemasIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' }); return
      }
      // Recarrega lista de co-tutores
      const listaRes  = await fetch(`/api/co-tutores?moduloId=${modulo.id}`)
      const listaData = await listaRes.json()
      if (Array.isArray(listaData)) setCoTutores(listaData)

      limparSelecao()
      setPasso('busca')
      toast({ title: '✅ Substituto adicionado', description: profSelecionado.nome })
    } finally { setSalvando(false) }
  }

  // ── Salvar edição de permissões de co-tutor existente ───────────────────
  const salvarEdicao = async (tutorId: string) => {
    setSalvando(true)
    try {
      const problemasIds = [...new Set(permsEdit.map(p => p.problemaId))]
      const res = await fetch('/api/co-tutores', {
        method:  'POST', // POST com upsert (delete + recreate)
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ moduloId: modulo.id, tutorId, problemasIds }),
      })
      if (!res.ok) { toast({ title: 'Erro ao salvar', variant: 'destructive' }); return }
      const listaRes  = await fetch(`/api/co-tutores?moduloId=${modulo.id}`)
      const listaData = await listaRes.json()
      if (Array.isArray(listaData)) setCoTutores(listaData)
      setEditandoId(null)
      toast({ title: 'Permissões atualizadas' })
    } finally { setSalvando(false) }
  }

  // ── Remover substituto ───────────────────────────────────────────────────
  const removerSubstituto = async (tutorId: string, nome: string) => {
    await fetch('/api/co-tutores', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ moduloId: modulo.id, tutorId }),
    })
    setCoTutores((prev) => prev.filter((ct) => ct.tutorId !== tutorId))
    toast({ title: 'Substituto removido', description: nome })
  }

  // ── Situações Excepcionais ────────────────────────────────────────────────
  const abrirGerEE = async () => {
    const novo = !gerEE
    setGerEE(novo)
    if (novo && encontrosEsp.length === 0) {
      try {
        const [eeRes, modRes] = await Promise.all([
          fetch(`/api/encontros-especiais?moduloId=${modulo.id}`),
          fetch('/api/modulos/ativos'),
        ])
        const eeData  = await eeRes.json()
        const modData = await modRes.json()
        if (Array.isArray(eeData))  setEncontrosEsp(eeData)
        if (Array.isArray(modData)) setModulosAtivos(modData.filter((m: any) => m.id !== modulo.id))
      } catch {}
    }
  }

  const problemasDoDest = modulosAtivos.find((m: any) => m.id === eeModDest)?.problemas ?? []
  const tiposParaProb = (prob: any) => {
    if (!prob) return []
    if (prob.temSaltoTriplo)
      return [
        { v: 'ABERTURA', l: 'Abertura' },
        { v: 'FECHAMENTO_A', l: 'Fechamento A (ST)' },
        { v: 'FECHAMENTO_B', l: 'Fechamento B (ST)' },
      ]
    return [{ v: 'ABERTURA', l: 'Abertura' }, { v: 'FECHAMENTO', l: 'Fechamento' }]
  }
  const probDest = problemasDoDest.find((p: any) => p.id === eeProblema)

  const salvarSituacaoExcepcional = async () => {
    if (!eeProblema || !eeTipo || eeAlunos.length === 0) {
      toast({ title: 'Selecione aluno(s), problema destino e tipo de encontro', variant: 'destructive' }); return
    }
    setSalvandoEE(true)
    try {
      const alocacoes = eeAlunos.map((alunoId) => ({
        alunoId,
        problemaDestinoId: eeProblema,
        tipoEncontro:      eeTipo,
        observacao:        eeObs || null,
      }))
      const res  = await fetch('/api/encontros-especiais', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ moduloOrigemId: modulo.id, alocacoes }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: data.error, variant: 'destructive' }); return }
      setEncontrosEsp((prev) => {
        const novos = Array.isArray(data) ? data : [data]
        const semDup = prev.filter((e: any) => !novos.some(
          (n: any) => n.alunoId === e.alunoId && n.problemaDestinoId === e.problemaDestinoId && n.tipoEncontro === e.tipoEncontro
        ))
        return [...semDup, ...novos]
      })
      setEeAlunos([]); setEeModDest(''); setEeProblema(''); setEeTipo(''); setEeObs('')
      toast({ title: `✅ ${eeAlunos.length} aluno(s) alocado(s)` })
    } finally { setSalvandoEE(false) }
  }

  const removerSituacaoExcepcional = async (id: string) => {
    await fetch('/api/encontros-especiais', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ situacaoExcepcionalId: id }),
    })
    setEncontrosEsp((prev) => prev.filter((e: any) => e.id !== id))
    toast({ title: 'Encontro especial removido' })
  }

  return (
    <div className={`bg-white rounded-xl border ${!isTitular ? 'border-amber-300' : 'border-gray-200'}`}>

      {!isTitular && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 rounded-t-xl">
          <span className="text-xs font-medium text-amber-700">🔄 Substituto</span>
          {modulo.tutor && (
            <span className="text-xs text-amber-600">— Módulo de {modulo.tutor.nome}</span>
          )}
        </div>
      )}

      <div className="p-4 cursor-pointer select-none" onClick={handleExpandir}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-sm">{modulo.nome}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {modulo.ano} · {modulo.tutoria} · Turma {modulo.turma} · {modulo._count.matriculas} alunos
            </p>
          </div>
          <span className="text-gray-400 text-lg mt-0.5 select-none">{expandido ? '▲' : '▼'}</span>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-100 p-4 space-y-3">

          {/* Problemas */}
          {problemas.map((prob) => (
            <div key={prob.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {prob.nome ?? `Problema ${String(prob.numero).padStart(2, '0')}`}
                </span>
                {prob.temSaltoTriplo && (
                  <span className="text-xs bg-[#1F4E79] text-white px-1.5 py-0.5 rounded font-bold">ST</span>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-medium">Abertura</span>
                    {(() => { const c = getContador(prob.id, 'ABERTURA'); return c ? (
                      <ContadorBadge enviadas={c.enviadas} total={c.total} ativo={c.ativo} />
                    ) : null })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {prob.aberturaAtiva && (
                      <Link
                        href={`/professor/avaliar?problemaId=${prob.id}&tipo=ABERTURA&nome=${encodeURIComponent(prob.nome ?? '')}`}
                        className="text-xs text-blue-600 underline"
                        onClick={(e) => e.stopPropagation()}
                      >Avaliar</Link>
                    )}
                    <Toggle ativo={prob.aberturaAtiva} onChange={() => toggleEncontro(prob.id, 'ABERTURA', !prob.aberturaAtiva)} />
                  </div>
                </div>

                {prob.temSaltoTriplo ? (
                  <>
                    {(['FECHAMENTO_A', 'FECHAMENTO_B'] as const).map((tipo) => {
                      const ativo = tipo === 'FECHAMENTO_A' ? prob.fechamentoAAtivo : prob.fechamentoBAtivo
                      const label = tipo === 'FECHAMENTO_A' ? 'Fechamento A' : 'Fechamento B'
                      return (
                        <div key={tipo} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-700 font-medium">{label}</span>
                            {(() => { const c = getContador(prob.id, tipo); return c ? (
                              <ContadorBadge enviadas={c.enviadas} total={c.total} ativo={c.ativo} />
                            ) : null })()}
                          </div>
                          <div className="flex items-center gap-2">
                            {ativo && (
                              <Link
                                href={`/professor/avaliar?problemaId=${prob.id}&tipo=${tipo}&nome=${encodeURIComponent(prob.nome ?? '')}`}
                                className="text-xs text-blue-600 underline"
                                onClick={(e) => e.stopPropagation()}
                              >Avaliar</Link>
                            )}
                            <Toggle ativo={ativo} onChange={() => toggleEncontro(prob.id, tipo, !ativo)} />
                          </div>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 font-medium">Fechamento</span>
                      {(() => { const c = getContador(prob.id, 'FECHAMENTO'); return c ? (
                        <ContadorBadge enviadas={c.enviadas} total={c.total} ativo={c.ativo} />
                      ) : null })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {prob.fechamentoAtivo && (
                        <Link
                          href={`/professor/avaliar?problemaId=${prob.id}&tipo=FECHAMENTO&nome=${encodeURIComponent(prob.nome ?? '')}`}
                          className="text-xs text-blue-600 underline"
                          onClick={(e) => e.stopPropagation()}
                        >Avaliar</Link>
                      )}
                      <Toggle ativo={prob.fechamentoAtivo} onChange={() => toggleEncontro(prob.id, 'FECHAMENTO', !prob.fechamentoAtivo)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Relatório */}
          <Link
            href={`/professor/relatorios?moduloId=${modulo.id}`}
            className="block w-full text-center text-sm text-[#1F4E79] font-medium border border-[#1F4E79] rounded-lg py-2 hover:bg-[#1F4E79] hover:text-white transition-colors"
          >
            Ver Relatório de Notas
          </Link>

          {/* ── Gerenciar Substitutos ─────────────────────────────────────────── */}
          {isTitular && (
            <div className="border border-gray-200 rounded-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setGerenciando(!gerenciando)
                  if (gerenciando) { limparSelecao(); setPasso('busca') }
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm ${gerenciando ? 'rounded-t-xl' : 'rounded-xl'}`}
              >
                <span className="font-medium text-gray-700">
                  👥 Substitutos
                  {coTutores.length > 0 && (
                    <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                      {coTutores.length}
                    </span>
                  )}
                </span>
                <span className="text-gray-400 text-xs">{gerenciando ? '▲' : '▼'}</span>
              </button>

              {gerenciando && (
                <div className="px-4 py-3 space-y-3 bg-white" onClick={(e) => e.stopPropagation()}>

                  {/* Lista de substitutos cadastrados */}
                  {coTutores.length > 0 && (
                    <div className="space-y-2">
                      {coTutores.map((ct) => (
                        <div key={ct.tutorId} className="border border-amber-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between bg-amber-50 px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{ct.tutor.nome}</p>
                              <p className="text-xs text-gray-400">{ct.tutor.email}</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editandoId === ct.tutorId) { setEditandoId(null) }
                                  else {
                                    setEditandoId(ct.tutorId)
                                    // Monta lista de perms a partir dos problemas do co-tutor
                                    const perms: {problemaId:string;tipoEncontro:string}[] = []
                                    if (ct.problemas) {
                                      for (const p of ct.problemas) {
                                        for (const t of tiposDisponiveis(problemas.find(x=>x.id===p.id) ?? problemas[0])) {
                                          perms.push({ problemaId: p.id, tipoEncontro: t.value })
                                        }
                                      }
                                    }
                                    setPermsEdit(perms)
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                              >
                                {editandoId === ct.tutorId ? 'Cancelar' : '✏️ Editar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => removerSubstituto(ct.tutorId, ct.tutor.nome)}
                                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                              >
                                Remover
                              </button>
                            </div>
                          </div>

                          {editandoId !== ct.tutorId ? (
                            <div className="px-3 py-2">
                              <p className="text-xs text-gray-500 font-medium mb-1">Problemas com acesso:</p>
                              <div className="flex flex-wrap gap-1">
                                {(ct.problemas ?? []).map((p: any) => (
                                  <span key={p.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                    P{p.numero}{p.nome ? ` — ${p.nome}` : ''}
                                  </span>
                                ))}
                                {(!ct.problemas || ct.problemas.length === 0) && (
                                  <span className="text-xs text-gray-400 italic">Acesso geral ao módulo</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="px-3 py-2 space-y-2">
                              <p className="text-xs text-gray-500 font-medium">Editar permissões:</p>
                              {problemas.map((prob) => (
                                <div key={prob.id}>
                                  <p className="text-xs font-medium text-gray-700 mb-1">
                                    P{String(prob.numero).padStart(2,'0')} {prob.nome ? `— ${prob.nome}` : ''}
                                    {prob.temSaltoTriplo && <span className="ml-1 bg-[#1F4E79] text-white text-xs px-1 rounded">ST</span>}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 pl-2">
                                    {tiposDisponiveis(prob).map(({value,label}) => {
                                      const checked = permsEdit.some(p=>p.problemaId===prob.id&&p.tipoEncontro===value)
                                      return (
                                        <label key={value} className="flex items-center gap-1 cursor-pointer">
                                          <input type="checkbox" checked={checked}
                                            onChange={() => togglePerm(permsEdit, setPermsEdit, prob.id, value)}
                                            className="rounded border-gray-300 text-amber-500" />
                                          <span className="text-xs text-gray-600">{label}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                disabled={salvando}
                                onClick={() => salvarEdicao(ct.tutorId)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-lg disabled:opacity-40"
                              >
                                {salvando ? 'Salvando...' : '💾 Salvar permissões'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {coTutores.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">adicionar novo</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}

                  {/* ── Passo 1: Autocomplete de professor ─────────────────── */}
                  {passo === 'busca' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">
                        Buscar docente substituto:
                      </p>
                      <div className="relative" ref={dropdownRef}>
                        <input
                          type="text"
                          value={buscaProf}
                          onChange={(e) => {
                            setBuscaProf(e.target.value)
                            setProfSelecionado(null)
                          }}
                          placeholder="Digite nome ou e-mail do professor..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />

                        {/* Indicador de carregamento */}
                        {buscandoProf && (
                          <p className="text-xs text-gray-400 mt-1">Buscando...</p>
                        )}

                        {/* Dropdown de resultados */}
                        {resultadosProf.length > 0 && (
                          <div className="absolute z-[9999] w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {resultadosProf.map((prof) => (
                              <button
                                key={prof.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()} // evita blur antes do click
                                onClick={() => selecionarProf(prof)}
                                className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-100 last:border-0 transition-colors"
                              >
                                <p className="text-xs font-medium text-gray-800">{prof.nome}</p>
                                <p className="text-xs text-gray-400">{prof.email}</p>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Nenhum resultado */}
                        {!buscandoProf && buscaProf.length >= 2 && resultadosProf.length === 0 && !profSelecionado && (
                          <p className="text-xs text-gray-400 mt-1">
                            Nenhum docente encontrado. O professor precisa ter feito login no sistema ao menos uma vez.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Passo 2: Selecionar permissões ─────────────────────── */}
                  {passo === 'permissoes' && profSelecionado && (
                    <div className="space-y-3 border border-amber-200 rounded-xl p-3 bg-amber-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-800">{profSelecionado.nome}</p>
                          <p className="text-xs text-gray-500">{profSelecionado.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={limparSelecao}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ← Voltar
                        </button>
                      </div>

                      <p className="text-xs font-semibold text-gray-700">
                        Selecione quais encontros o substituto pode avaliar:
                      </p>

                      <div className="space-y-2.5">
                        {problemas.map((prob) => (
                          <div key={prob.id} className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                            <p className="text-xs font-medium text-gray-700 mb-1.5">
                              Problema {String(prob.numero).padStart(2,'0')}
                              {prob.nome ? ` — ${prob.nome}` : ''}
                              {prob.temSaltoTriplo && (
                                <span className="ml-1.5 bg-[#1F4E79] text-white text-xs px-1.5 py-0.5 rounded font-bold">ST</span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {tiposDisponiveis(prob).map(({value, label}) => {
                                const checked = permsWizard.some(p=>p.problemaId===prob.id&&p.tipoEncontro===value)
                                return (
                                  <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePerm(permsWizard, setPermsWizard, prob.id, value)}
                                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                                    />
                                    <span className="text-xs text-gray-700">{label}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500 flex-1">
                          {permsWizard.length} encontro{permsWizard.length !== 1 ? 's' : ''} selecionado{permsWizard.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          disabled={salvando || permsWizard.length === 0}
                          onClick={salvarSubstituto}
                          className="bg-[#1F4E79] hover:bg-[#163d61] text-white text-xs px-4 py-1.5 rounded-lg disabled:opacity-40"
                        >
                          {salvando ? 'Salvando...' : '✅ Confirmar substituto'}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* Situações Excepcionais */}
          {isTitular && (
            <a
              href={`/professor/modulos/${modulo.id}/realocar`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between w-full border border-purple-200 rounded-xl px-4 py-2.5 bg-purple-50 hover:bg-purple-100 transition-colors text-sm"
            >
              <span className="font-medium text-purple-800">🔄 Situações Excepcionais</span>
              <span className="text-purple-400 text-xs">Gerenciar →</span>
            </a>
          )}

          {/* Ações do módulo */}
          {isTitular && (
            <div className="flex gap-2 pt-1">
              <Link
                href={`/professor/modulos/${modulo.id}/editar`}
                className="flex-1 text-xs text-center border border-[#2E75B6] text-[#2E75B6] rounded-lg py-2 hover:bg-blue-50 transition-colors font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                ✏️ Editar
              </Link>
              <button
                onClick={() => setConfirmando('arquivar')}
                className="flex-1 text-xs border border-amber-300 text-amber-700 rounded-lg py-2 hover:bg-amber-50 transition-colors"
              >
                Arquivar
              </button>
              {temAvaliacoes ? (
                <button
                  disabled
                  title="Módulo com avaliações lançadas só pode ser arquivado"
                  className="flex-1 text-xs border border-gray-200 text-gray-400 rounded-lg py-2 cursor-not-allowed"
                >
                  🔒 Excluir
                </button>
              ) : (
                <button
                  onClick={() => setConfirmando('excluir')}
                  className="flex-1 text-xs border border-red-300 text-red-600 rounded-lg py-2 hover:bg-red-50 transition-colors"
                >
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmando && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 rounded-b-xl">
          {confirmando === 'arquivar' ? (
            <>
              <p className="text-sm font-semibold text-amber-700 mb-1">Arquivar este módulo?</p>
              <p className="text-xs text-gray-500 mb-3">
                O módulo sairá do dashboard mas pode ser consultado em "Módulos Arquivados". Os dados são preservados.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-red-700 mb-1">Excluir este módulo?</p>
              <p className="text-xs text-gray-500 mb-3">
                Esta ação é permanente. Todos os dados do módulo serão excluídos definitivamente.
              </p>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmando(null)}
              disabled={processando}
              className="flex-1 text-xs border border-gray-300 text-gray-600 rounded-lg py-2"
            >
              Cancelar
            </button>
            <button
              onClick={() => executarAcao(confirmando)}
              disabled={processando}
              className={`flex-1 text-xs text-white rounded-lg py-2 disabled:opacity-60 ${
                confirmando === 'excluir' ? 'bg-red-600' : 'bg-amber-600'
              }`}
            >
              {processando
                ? 'Aguarde...'
                : confirmando === 'excluir' ? 'Sim, excluir' : 'Sim, arquivar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ContadorBadge({ enviadas, total, ativo }: { enviadas: number; total: number; ativo: boolean }) {
  if (!ativo && enviadas === 0) return null
  const completo = total > 0 && enviadas >= total
  return (
    <span
      title={`${enviadas} de ${total} alunos enviaram`}
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
        completo ? 'bg-green-100 text-green-700' : ativo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {enviadas}/{total}
    </span>
  )
}
