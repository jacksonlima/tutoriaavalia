/**
 * TutoriaAvalia v2 — Sistema de Avaliação Formativa para ABP
 * Autor: Jackson Lima — CESUPA
 *
 * NotificationBell — sino de notificações para tutores.
 * Otimizado com SWR: faz polling a cada 30s, mas pausa
 * automaticamente se a aba do navegador perder o foco (economia na Vercel).
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'

// Esta linha ensina o SWR a ler os dados da sua API
const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Notificacao = {
  id:           string
  titulo:       string
  mensagem:     string
  tipoEncontro: string | null
  lida:         boolean
  criadaEm:     string
}

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
  const [aberto, setAberto]         = useState(false)
  const [carregando, setCarregando] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. A MÁGICA DO SWR AQUI:
  // Substitui os antigos useState e setInterval.
  const { data, mutate } = useSWR<{ notificacoes: Notificacao[], totalNaoLidas: number }>(
    '/api/notificacoes',
    fetcher,
    {
      refreshInterval: 30000,  // Continua checando a cada 30s
      revalidateOnFocus: true, // Atualiza na hora se o professor voltar para a aba
      refreshWhenHidden: false // ESSENCIAL: Pausa tudo se a aba for minimizada
    }
  )

  // Extrai os dados do SWR com segurança (fallback para vazio caso esteja carregando)
  const notificacoes = data?.notificacoes ?? []
  const totalNaoLidas = data?.totalNaoLidas ?? 0

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

  const abrirDropdown = () => {
    setAberto((v) => !v)
  }

  const marcarTodasLidas = async () => {
    setCarregando(true)
    try {
      // Atualização otimista: muda na tela antes de ir pro banco para parecer instantâneo
      mutate({
        notificacoes: notificacoes.map((n) => ({ ...n, lida: true })),
        totalNaoLidas: 0
      }, false)

      await fetch('/api/notificacoes', { method: 'PATCH', cache: 'no-store' })
      
      // Sincroniza com o servidor
      mutate()
    } finally {
      setCarregando(false)
    }
  }

  const marcarUmaLida = async (id: string) => {
    // Atualização otimista na tela
    mutate({
      notificacoes: notificacoes.map((n) => n.id === id ? { ...n, lida: true } : n),
      totalNaoLidas: Math.max(0, totalNaoLidas - 1)
    }, false)

    await fetch(`/api/notificacoes?id=${id}`, { method: 'PATCH', cache: 'no-store' })
    
    // Sincroniza com o servidor
    mutate()
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
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center flex flex-col gap-1">
              <p className="text-[10px] text-gray-400">
                Atualiza a cada 30s (pausa se aba inativa)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}