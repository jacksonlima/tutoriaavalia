'use client'

/**
 * Notas da Tutoria v2 — Botão de Exclusão de Módulo
 * Autor: Jackson Lima — CESUPA
 *
 * Exibe botão "Excluir" com modal de confirmação.
 * Após exclusão, recarrega a página automaticamente.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  moduloId:   string
  moduloNome: string
}

export function DeleteModuloButton({ moduloId, moduloNome }: Props) {
  const router             = useRouter()
  const [aberto,  setAberto]  = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [erro,    setErro]    = useState('')

  const confirmar = async () => {
    setDeletando(true)
    setErro('')
    try {
      const res = await fetch(`/api/modulos/${moduloId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir')
      setAberto(false)
      router.refresh()
    } catch (e: any) {
      setErro(e.message)
      setDeletando(false)
    }
  }

  return (
    <>
      {/* Botão Excluir */}
      <button
        onClick={() => { setAberto(true); setErro('') }}
        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors px-2 py-1 rounded hover:bg-red-50"
      >
        Excluir
      </button>

      {/* Modal de confirmação */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">

            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑️</div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Excluir módulo permanentemente?
              </h2>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{moduloNome}</span>
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
              <p className="text-sm text-red-800 font-semibold mb-1">
                ⚠️ Esta ação é irreversível
              </p>
              <p className="text-xs text-red-700 leading-relaxed">
                Serão excluídos permanentemente: todas as avaliações dos alunos,
                avaliações do tutor, notas, submissões, matrículas e todos os
                dados do módulo. Não será possível recuperar.
              </p>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                {erro}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setAberto(false)}
                disabled={deletando}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={deletando}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {deletando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
