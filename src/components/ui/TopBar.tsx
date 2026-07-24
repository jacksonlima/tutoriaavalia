/**
 * Notas da Tutoria v2 — Sistema de Avaliação Formativa para PBL
 * Autor: Jackson Lima — CESUPA
 *
 * TopBar — barra superior com logo NT, nome do usuário e sino de notificações.
 */

'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { NotificationBell } from '@/components/ui/NotificationBell'

interface TopBarProps {
  nome?:       string
  papel?:      'TUTOR' | 'ALUNO'
  backHref?:   string
  backLabel?:  string
}

export function TopBar({ nome, papel, backHref, backLabel }: TopBarProps) {
  const { data: session } = useSession()
  const nomeExibido = nome ?? session?.user?.nome ?? session?.user?.email ?? ''

  const dashHref = papel === 'TUTOR' ? '/professor/dashboard' : '/aluno/dashboard'

  return (
    <header className="bg-[#1F4E79] text-white shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* Logo + nome do app */}
        <Link href={dashHref} className="flex items-center gap-2.5 shrink-0">
          {/* Logo NT — substituiu TA */}
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold leading-none">NT</span>
          </div>
          <span className="font-semibold text-sm hidden sm:block">Notas da Tutoria</span>
        </Link>

        {/* Botão de voltar (opcional) */}
        {backHref && (
          <Link
            href={backHref}
            className="text-white/80 hover:text-white text-xs flex items-center gap-1 transition-colors"
          >
            ← {backLabel ?? 'Voltar'}
          </Link>
        )}

        {/* Direita: nome + sino + sair */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Nome do usuário */}
          {nomeExibido && (
            <span className="text-xs text-white/80 hidden sm:block truncate max-w-[140px]">
              {nomeExibido}
            </span>
          )}

          {/* Sino de notificações (só para tutores) */}
          {papel === 'TUTOR' && <NotificationBell />}

          {/* Botão sair */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-white/70 hover:text-white text-xs transition-colors whitespace-nowrap"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
