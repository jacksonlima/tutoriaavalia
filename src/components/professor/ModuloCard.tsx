'use client'

import Link from 'next/link'
import { useState } from 'react'
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
}

type CoTutorPermItem = { id: string; problemaId: string; tipoEncontro: string }
type CoTutorItem = { id: string; tutorId: string; tutor: { nome: string; email: string }; permissoes?: CoTutorPermItem[] }

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
    tutor?: { nome: string }  // presente apenas nos módulos onde o user é co-tutor
  }
  isTitular: boolean  // true = titular, false = co-tutor/substituto
}

export function ModuloCard({ modulo, isTitular }: ModuloCardProps) {
  const [problemas, setProblemas] = useState(modulo.problemas)
  const [expandido, setExpandido]       = useState(false)
  const [confirmando, setConfirmando]   = useState<'excluir' | 'arquivar' | null>(null)
  const [processando, setProcessando]   = useState(false)
  // Co-tutores
  const [coTutores,   setCoTutores]   = useState<CoTutorItem[]>([])
  const [gerenciando, setGerenciando] = useState(false)
  // Wizard para adicionar substituto
  const [passo,       setPasso]       = useState<'email'|'permissoes'>('email')
  const [emailSubst,  setEmailSubst]  = useState('')
  const [docEncontrado, setDocEncontrado] = useState<{nome:string;email:string}|null>(null)
  const [permsWizard, setPermsWizard] = useState<{problemaId:string;tipoEncontro:string}[]>([])
  const [buscando,    setBuscando]    = useState(false)
  const [salvando,    setSalvando]    = useState(false)
  // Edição inline de permissões
  const [editandoId,  setEditandoId]  = useState<string|null>(null)
  const [permsEdit,   setPermsEdit]   = useState<{problemaId:string;tipoEncontro:string}[]>([])
  // Encontros Especiais
  const [gerEE,         setGerEE]         = useState(false)
  const [encontrosEsp,  setEncontrosEsp]  = useState<any[]>([])
  const [eeAlunos,      setEeAlunos]      = useState<string[]>([])  // ids selecionados
  const [eeModDest,     setEeModDest]     = useState('')             // moduloId destino
  const [eeProblema,    setEeProblema]    = useState('')             // problemaId destino
  const [eeTipo,        setEeTipo]        = useState('')             // tipoEncontro
  const [eeObs,         setEeObs]         = useState('')
  const [modulosAtivos, setModulosAtivos] = useState<any[]>([])
  const [salvandoEE,    setSalvandoEE]    = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Contadores de submissão — atualiza a cada 60s quando o card está expandido
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

  // Toggle: stopPropagation evita que o clique suba para o container pai
  // (que abre/fecha o card), prevenindo ativação/desativação acidental do encontro
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

  // ── Helpers de permissão ────────────────────────────────────
  const tiposDisponiveis = (prob: Problema) => {
    const tipos: {value:string; label:string}[] = []
    if (prob.aberturaAtiva || true)   tipos.push({ value:'ABERTURA',    label:'Abertura' })
    if (prob.temSaltoTriplo) {
      tipos.push({ value:'FECHAMENTO_A', label:'Fechamento A (ST)' })
      tipos.push({ value:'FECHAMENTO_B', label:'Fechamento B (ST)' })
    } else {
      tipos.push({ value:'FECHAMENTO',   label:'Fechamento' })
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

  // ── Expandir card + carregar co-tutores ──────────────────────
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

  // ── Passo 1: busca o docente pelo email ──────────────────────
  const buscarDocente = async () => {
    if (!emailSubst.trim()) return
    setBuscando(true)
    try {
      const res  = await fetch('/api/usuarios/buscar?email=' + encodeURIComponent(emailSubst.trim()))
      const data = await res.json()
      if (!res.ok || !data.id) {
        toast({ title: 'Não encontrado', description: data.error ?? 'Docente não cadastrado', variant: 'destructive' })
        return
      }
      if (data.papel !== 'TUTOR') {
        toast({ title: 'Inválido', description: 'Este usuário não é docente.', variant: 'destructive' })
        return
      }
      setDocEncontrado({ nome: data.nome, email: data.email })
      setPermsWizard([])
      setPasso('permissoes')
    } finally { setBuscando(false) }
  }

  // ── Passo 2: salva co-tutor com permissões ───────────────────
  const salvarSubstituto = async () => {
    if (permsWizard.length === 0) {
      toast({ title: 'Selecione ao menos uma permissão', variant: 'destructive' }); return
    }
    setSalvando(true)
    try {
      const res  = await fetch('/api/co-tutores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduloId: modulo.id, email: emailSubst.trim(), permissoes: permsWizard }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: data.error, variant: 'destructive' }); return }
      setCoTutores((prev) => {
        const sem = prev.filter(ct => ct.tutorId !== data.tutorId)
        return [...sem, data]
      })
      setEmailSubst(''); setDocEncontrado(null); setPermsWizard([]); setPasso('email')
      toast({ title: '✅ Substituto adicionado', description: data.tutor.nome })
    } finally { setSalvando(false) }
  }

  // ── Salvar edição de permissões de um co-tutor existente ─────
  const salvarEdicao = async (coTutorId: string) => {
    setSalvando(true)
    try {
      const res = await fetch('/api/co-tutores', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coTutorId, permissoes: permsEdit }),
      })
      if (!res.ok) { toast({ title: 'Erro ao salvar', variant: 'destructive' }); return }
      setCoTutores((prev) => prev.map(ct =>
        ct.id === coTutorId ? { ...ct, permissoes: permsEdit as any } : ct
      ))
      setEditandoId(null)
      toast({ title: 'Permissões atualizadas' })
    } finally { setSalvando(false) }
  }

  // ── Remover substituto ────────────────────────────────────────
  const removerSubstituto = async (tutorId: string, nome: string) => {
    await fetch('/api/co-tutores', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduloId: modulo.id, tutorId }),
    })
    setCoTutores((prev) => prev.filter((ct) => ct.tutorId !== tutorId))
    toast({ title: 'Substituto removido', description: nome })
  }

  // ── Encontros Especiais ────────────────────────────────────────
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
      return [{ v: 'ABERTURA', l: 'Abertura' }, { v: 'FECHAMENTO_A', l: 'Fechamento A (ST)' }, { v: 'FECHAMENTO_B', l: 'Fechamento B (ST)' }]
    return [{ v: 'ABERTURA', l: 'Abertura' }, { v: 'FECHAMENTO', l: 'Fechamento' }]
  }
  const probDest = problemasDoDest.find((p: any) => p.id === eeProblema)

  const salvarEncontroEspecial = async () => {
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduloOrigemId: modulo.id, alocacoes }),
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

  const removerEncontroEspecial = async (id: string) => {
    await fetch('/api/encontros-especiais', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encontroEspecialId: id }),
    })
    setEncontrosEsp((prev) => prev.filter((e: any) => e.id !== id))
    toast({ title: 'Encontro especial removido' })
  }

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${!isTitular ? 'border-amber-300' : 'border-gray-200'}`}>

      {/* Badge substituto */}
      {!isTitular && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2">
          <span className="text-xs font-medium text-amber-700">🔄 Substituto</span>
          {modulo.tutor && (
            <span className="text-xs text-amber-600">— Módulo de {modulo.tutor.nome}</span>
          )}
        </div>
      )}

      {/* ── Cabeçalho clicável ── */}
      <div className="p-4 cursor-pointer select-none" onClick={handleExpandir}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-sm">{modulo.nome}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {modulo.ano} · {modulo.tutoria} · Turma {modulo.turma} · {modulo._count.matriculas} alunos
            </p>
          </div>
          <span className="text-gray-400 text-lg mt-0.5 select-none">
            {expandido ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* ── Conteúdo expandido ── */}
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
                {/* Abertura */}
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
                      >
                        Avaliar
                      </Link>
                    )}
                    <Toggle ativo={prob.aberturaAtiva} onChange={() => toggleEncontro(prob.id, 'ABERTURA', !prob.aberturaAtiva)} />
                  </div>
                </div>

                {/* Fechamento(s) */}
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
                              >
                                Avaliar
                              </Link>
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
                        >
                          Avaliar
                        </Link>
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

          {/* ── Gerenciar Substitutos (só para o titular) ── */}
          {isTitular && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setGerenciando(!gerenciando); setPasso('email'); setDocEncontrado(null) }}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
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

                  {/* ── Lista de substitutos cadastrados ── */}
                  {coTutores.length > 0 && (
                    <div className="space-y-2">
                      {coTutores.map((ct) => (
                        <div key={ct.id} className="border border-amber-200 rounded-lg overflow-hidden">
                          {/* Cabeçalho do co-tutor */}
                          <div className="flex items-center justify-between bg-amber-50 px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{ct.tutor.nome}</p>
                              <p className="text-xs text-gray-400">{ct.tutor.email}</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editandoId === ct.id) { setEditandoId(null) }
                                  else {
                                    setEditandoId(ct.id)
                                    setPermsEdit((ct.permissoes ?? []).map((p:any) => ({
                                      problemaId: p.problemaId, tipoEncontro: p.tipoEncontro
                                    })))
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                              >
                                {editandoId === ct.id ? 'Cancelar' : '✏️ Editar'}
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

                          {/* Permissões: visualização ou edição */}
                          {editandoId !== ct.id ? (
                            <div className="px-3 py-2">
                              <p className="text-xs text-gray-500 font-medium mb-1">Permissões:</p>
                              <div className="flex flex-wrap gap-1">
                                {(ct.permissoes ?? []).map((p:any) => (
                                  <span key={`${p.problemaId}|${p.tipoEncontro}`}
                                    className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                    P{problemas.find(x=>x.id===p.problemaId)?.numero ?? '?'} — {
                                      p.tipoEncontro === 'ABERTURA'    ? 'Ab' :
                                      p.tipoEncontro === 'FECHAMENTO'  ? 'Fe' :
                                      p.tipoEncontro === 'FECHAMENTO_A'? 'FeA':
                                      p.tipoEncontro === 'FECHAMENTO_B'? 'FeB': p.tipoEncontro
                                    }
                                  </span>
                                ))}
                                {(!ct.permissoes || ct.permissoes.length === 0) && (
                                  <span className="text-xs text-gray-400 italic">Nenhuma permissão</span>
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
                                onClick={() => salvarEdicao(ct.id)}
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

                  {/* ── Divider ── */}
                  {coTutores.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">adicionar novo</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}

                  {/* ── Wizard: Passo 1 — Email ── */}
                  {passo === 'email' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">Email do docente substituto:</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailSubst}
                          onChange={(e) => setEmailSubst(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarDocente() } }}
                          placeholder="email@prof.cesupa.br"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          type="button"
                          disabled={buscando || !emailSubst.trim()}
                          onClick={buscarDocente}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 whitespace-nowrap"
                        >
                          {buscando ? '...' : 'Buscar →'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">
                        O docente precisa ter feito login no sistema pelo menos uma vez.
                      </p>
                    </div>
                  )}

                  {/* ── Wizard: Passo 2 — Permissões ── */}
                  {passo === 'permissoes' && docEncontrado && (
                    <div className="space-y-3 border border-amber-200 rounded-xl p-3 bg-amber-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-800">{docEncontrado.nome}</p>
                          <p className="text-xs text-gray-500">{docEncontrado.email}</p>
                        </div>
                        <button type="button" onClick={() => { setPasso('email'); setDocEncontrado(null) }}
                          className="text-xs text-gray-400 hover:text-gray-600">← Voltar</button>
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

                      <div className="flex gap-2 pt-1">
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

          {/* ── Encontros Especiais — apenas para titular ── */}
          {isTitular && (
            <a
              href={`/professor/modulos/${modulo.id}/realocar`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between w-full border border-purple-200 rounded-xl px-4 py-2.5 bg-purple-50 hover:bg-purple-100 transition-colors text-sm"
            >
              <span className="font-medium text-purple-800">
                🔄 Encontros Especiais
              </span>
              <span className="text-purple-400 text-xs">Gerenciar →</span>
            </a>
          )}

          {/* Ações do módulo — apenas para titular */}
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
              <button
                onClick={() => setConfirmando('excluir')}
                className="flex-1 text-xs border border-red-300 text-red-600 rounded-lg py-2 hover:bg-red-50 transition-colors"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de confirmação (Arquivar / Excluir) ── */}
      {confirmando && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
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
                Esta ação é permanente. Todos os dados do módulo — alunos, problemas e notas — serão excluídos definitivamente.
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
                : confirmando === 'excluir'
                ? 'Sim, excluir'
                : 'Sim, arquivar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ContadorBadge — mostra X/Total de submissões ─────────────────────────

function ContadorBadge({
  enviadas,
  total,
  ativo,
}: {
  enviadas: number
  total:    number
  ativo:    boolean
}) {
  if (!ativo && enviadas === 0) return null
  const completo = total > 0 && enviadas >= total

  return (
    <span
      title={`${enviadas} de ${total} alunos enviaram`}
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
        completo
          ? 'bg-green-100 text-green-700'
          : ativo
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {enviadas}/{total}
    </span>
  )
}

