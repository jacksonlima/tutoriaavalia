/**
 * TutoriaAvalia v2 — Sistema de Avaliação Formativa para ABP
 * Autor: Jackson Lima — CESUPA
 *
 * useContadorSubmissoes — hook para buscar e manter atualizado
 * o progresso de submissões de um módulo.
 *
 * Faz polling a cada 60 segundos (cadência menor que as notificações
 * pois o contador é contextual — só importa quando o card está expandido).
 */

import { useState, useEffect, useCallback } from 'react'

export type ContadorItem = {
  problemaId:     string
  problemaNumero: number
  tipoEncontro:   string
  ativo:          boolean
  enviadas:       number
  total:          number
}

const POLLING_MS = 60_000 // 60 segundos

export function useContadorSubmissoes(moduloId: string, ativo: boolean) {
  const [contadores, setContadores] = useState<ContadorItem[]>([])
  const [carregando, setCarregando] = useState(false)

  const buscar = useCallback(async () => {
    if (!ativo) return
    setCarregando(true)
    try {
      const res = await fetch(`/api/submissoes/contador?moduloId=${moduloId}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setContadores(data)
      }
    } finally {
      setCarregando(false)
    }
  }, [moduloId, ativo])

  useEffect(() => {
    buscar()
    if (!ativo) return
    const timer = setInterval(buscar, POLLING_MS)
    return () => clearInterval(timer)
  }, [buscar, ativo])

  // Helper: busca o contador para um problema+tipo específico
  const getContador = (problemaId: string, tipoEncontro: string): ContadorItem | undefined =>
    contadores.find((c) => c.problemaId === problemaId && c.tipoEncontro === tipoEncontro)

  return { contadores, carregando, getContador, recarregar: buscar }
}
