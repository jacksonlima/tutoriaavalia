'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'

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
  }
}

export function ModuloCard({ modulo }: ModuloCardProps) {
  const [problemas, setProblemas] = useState(modulo.problemas)
  const [expandido, setExpandido]       = useState(false)
  const [confirmando, setConfirmando]   = useState<'excluir' | 'arquivar' | null>(null)
  const [processando, setProcessando]   = useState(false)
  const { toast } = useToast()
  const router = useRouter()

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* ── Cabeçalho clicável ── */}
      <div className="p-4 cursor-pointer select-none" onClick={() => setExpandido(!expandido)}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-sm">{modulo.nome}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {modulo.ano} · {modulo.tutoria} · Turma {modulo.turma} · {modulo._count.matriculas} alunos
            </p>
          </div>
          {/* Seta: usando caracteres Unicode diretamente — sem entidades HTML */}
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
                  <span className="text-xs text-gray-600 font-medium">Abertura</span>
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
                          <span className="text-xs text-amber-700 font-medium">{label}</span>
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
                    <span className="text-xs text-gray-600 font-medium">Fechamento</span>
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

          {/* Ações do módulo */}
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
