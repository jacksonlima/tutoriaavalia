/**
 * TutoriaAvalia v2 — Sistema de Avaliação Formativa para ABP
 * Autor: Jackson Lima — CESUPA
 *
 * NotificationBell — sino de notificações para tutores.
 * Faz polling a cada 30 segundos para buscar novas notificações.
 * Exibe badge com contagem de não lidas e dropdown com lista.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Notificacao = {
  id:           string
  titulo:       string
  mensagem:     string
  tipoEncontro: string | null
  lida:         boolean
  criadaEm:     string
}

const POLLING_INTERVAL_MS = 30_000 // 30 segundos

function formatarTempo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export function NotificationBell() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [totalNaoLidas, setTotalNaoLidas] = useState(0)
  const [aberto, setAberto]               = useState(false)
  const [carregando, setCarregando]       = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  const buscarNotificacoes = useCallback(async () => {
    try {
      const res  = await fetch('/api/notificacoes', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setNotificacoes(data.notificacoes ?? [])
      setTotalNaoLidas(data.totalNaoLidas ?? 0)
    } catch {
      // silencioso — polling falhou, tenta novamente no próximo intervalo
    }
  }, [])

  // Busca inicial + polling a cada 30s
  useEffect(() => {
    buscarNotificacoes()
    const timer = setInterval(buscarNotificacoes, POLLING_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [buscarNotificacoes])

  const abrirDropdown = async () => {
    setAberto((v) => !v)
  }

  const marcarTodasLidas = async () => {
    setCarregando(true)
    try {
      await fetch('/api/notificacoes', { method: 'PATCH', cache: 'no-store' })
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
      setTotalNaoLidas(0)
    } finally {
      setCarregando(false)
    }
  }

  const marcarUmaLida = async (id: string) => {
    await fetch(`/api/notificacoes?id=${id}`, { method: 'PATCH', cache: 'no-store' })
    setNotificacoes((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n))
    setTotalNaoLidas((v) => Math.max(0, v - 1))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão sino */}
      <button
        onClick={abrirDropdown}
        className="relative p-2 rounded-lg hover:bg-white/15 transition-colors"
        title="Notificações"
        aria-label={`${totalNaoLidas} notificações não lidas`}
      >
        <span className="text-lg leading-none">🔔</span>
        {totalNaoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-800">
              Notificações
              {totalNaoLidas > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {totalNaoLidas}
                </span>
              )}
            </span>
            {totalNaoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                disabled={carregando}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50"
              >
                Marcar todas lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[380px] overflow-y-auto">
            {notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-sm text-gray-400">Nenhuma notificação</p>
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.lida && marcarUmaLida(n.id)}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                    n.lida ? 'opacity-60' : 'bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lida && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold leading-tight ${n.lida ? 'text-gray-600' : 'text-gray-800'}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">
                        {n.mensagem}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatarTempo(n.criadaEm)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé */}
          {notificacoes.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">
                Atualiza automaticamente a cada 30s
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
