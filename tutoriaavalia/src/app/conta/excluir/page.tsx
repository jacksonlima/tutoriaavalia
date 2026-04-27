/**
 * TutoriaAvalia v2 — Exclusão de Conta
 * Autor: Jackson Lima — CESUPA
 *
 * Permite que o próprio usuário solicite e confirme a exclusão
 * de sua conta e todos os dados pessoais associados.
 * Conformidade com LGPD Art. 18°, III e VI.
 *
 * Acessível em: /conta/excluir (requer login)
 */
'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function ExcluirContaPage() {
  const { data: session } = useSession()
  const [etapa, setEtapa]         = useState<'aviso' | 'confirmar' | 'excluindo' | 'concluido' | 'erro'>('aviso')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [erro, setErro]           = useState('')

  const emailUsuario = session?.user?.email ?? ''

  const handleExcluir = async () => {
    if (confirmEmail.trim().toLowerCase() !== emailUsuario.toLowerCase()) {
      setErro('O e-mail digitado não corresponde ao e-mail da sua conta.')
      return
    }
    setErro('')
    setEtapa('excluindo')

    try {
      const res = await fetch('/api/conta/excluir', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setErro(data.error ?? 'Erro ao excluir conta.')
        setEtapa('confirmar')
        return
      }
      setEtapa('concluido')
      // Desloga após 3 segundos
      setTimeout(() => signOut({ callbackUrl: '/login' }), 3000)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setEtapa('confirmar')
    }
  }

  if (etapa === 'concluido') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Conta excluída</h1>
          <p className="text-sm text-gray-500">
            Seus dados pessoais foram removidos do sistema. Você será redirecionado em instantes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho simples */}
      <header className="bg-[#1F4E79] text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">TA</span>
            </div>
            <span className="font-semibold">TutoriaAvalia</span>
          </div>
          <Link
            href={session?.user?.papel === 'TUTOR' ? '/professor/dashboard' : '/aluno/dashboard'}
            className="text-sm text-blue-200 hover:text-white"
          >
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">

        {/* Etapa 1 — Aviso */}
        {etapa === 'aviso' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Excluir minha conta</h1>
              <p className="text-sm text-gray-500">
                Esta ação é permanente e não pode ser desfeita.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="font-semibold text-red-800 mb-3">O que será excluído permanentemente:</p>
              <ul className="space-y-1.5 text-sm text-red-700">
                <li className="flex gap-2"><span>•</span> Seu perfil (nome, e-mail, foto)</li>
                <li className="flex gap-2"><span>•</span> Todas as avaliações que você enviou</li>
                <li className="flex gap-2"><span>•</span> Suas matrículas nos módulos</li>
                <li className="flex gap-2"><span>•</span> Notificações e submissões</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Nota:</strong> Se você for professor titular de módulos ativos, a exclusão
              da conta afetará esses módulos. Entre em contato com{' '}
              <a href="mailto:privacidade@cesupa.br" className="underline">
                privacidade@cesupa.br
              </a>{' '}
              antes de prosseguir.
            </div>

            <div className="flex gap-3">
              <Link
                href={session?.user?.papel === 'TUTOR' ? '/professor/dashboard' : '/aluno/dashboard'}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium text-center hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </Link>
              <button
                onClick={() => setEtapa('confirmar')}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Etapa 2 — Confirmação com e-mail */}
        {(etapa === 'confirmar' || etapa === 'excluindo') && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">🔐</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Confirme sua identidade</h1>
              <p className="text-sm text-gray-500">
                Para excluir sua conta, digite seu e-mail abaixo.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seu e-mail ({emailUsuario})
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={emailUsuario}
                  disabled={etapa === 'excluindo'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-50"
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {erro}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setEtapa('aviso'); setConfirmEmail(''); setErro('') }}
                disabled={etapa === 'excluindo'}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={handleExcluir}
                disabled={etapa === 'excluindo' || !confirmEmail}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {etapa === 'excluindo' ? 'Excluindo...' : '🗑️ Excluir minha conta'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
