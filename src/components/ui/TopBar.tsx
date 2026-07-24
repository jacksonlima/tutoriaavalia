/**
 * Notas da Tutoria v2 — Sistema de Avaliação Formativa para PBL
 * Autor: Jackson Lima — CESUPA
 *
 * TopBar — paleta de cores CESUPA (www.cesupa.br)
 * Navy: #1B2280 | Blue: #3A50C8
 */

'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { NotificationBell } from '@/components/ui/NotificationBell'

interface TopBarProps {
  nome?:      string
  papel?:     'TUTOR' | 'ALUNO'
  backHref?:  string
  backLabel?: string
}

export function TopBar({ nome, papel, backHref, backLabel }: TopBarProps) {
  const { data: session } = useSession()
  const nomeExibido = nome ?? session?.user?.nome ?? session?.user?.email ?? ''

  const dashHref = papel === 'TUTOR' ? '/professor/dashboard' : '/aluno/dashboard'

  return (
    <header className="text-white shadow-sm" style={{ backgroundColor: '#1B2280' }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* Logo NT */}
        <Link href={dashHref} className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white text-sm font-bold leading-none tracking-tight">NT</span>
          </div>
          <span className="font-semibold text-sm hidden sm:block">Notas da Tutoria</span>
        </Link>

        {/* Botão de voltar (opcional) */}
        {backHref && (
          <Link href={backHref}
            className="text-white/80 hover:text-white text-xs flex items-center gap-1 transition-colors">
            ← {backLabel ?? 'Voltar'}
          </Link>
        )}

        {/* Direita: nome + sino + sair */}
        <div className="flex items-center gap-3 ml-auto">
          {nomeExibido && (
            <span className="text-xs text-white/80 hidden sm:block truncate max-w-[140px]">
              {nomeExibido}
            </span>
          )}
          {papel === 'TUTOR' && <NotificationBell />}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-white/70 hover:text-white text-xs transition-colors whitespace-nowrap">
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
