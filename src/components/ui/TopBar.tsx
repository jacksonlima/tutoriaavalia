'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'

interface TopBarProps {
  nome:       string
  papel:      'TUTOR' | 'ALUNO'
  backHref?:  string  // se informado, exibe botão "← Voltar" antes do logo
  backLabel?: string  // texto do botão (default: "Voltar")
}

export function TopBar({ nome, papel, backHref, backLabel = 'Voltar' }: TopBarProps) {
  const dashboard = papel === 'TUTOR' ? '/professor/dashboard' : '/aluno/dashboard'

  return (
    <header className="bg-[#1F4E79] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-md">
      <div className="flex items-center gap-2">

        {/* Botão de voltar — ← texto visível */}
        {backHref && (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/25 transition-colors rounded-lg px-3 py-1.5 mr-1"
          >
            {/* Seta usando caractere Unicode direto — entidade HTML não funciona em JSX */}
            <span className="text-sm font-bold">{'←'}</span>
            <span className="text-xs font-medium hidden sm:block">{backLabel}</span>
          </Link>
        )}

        {/* Logo + nome do sistema */}
        <Link href={dashboard} className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold">TA</span>
          </div>
          <span className="font-semibold text-sm hidden sm:block">TutoriaAvalia</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium leading-tight">{nome}</p>
          <p className="text-xs text-blue-200">
            {papel === 'TUTOR' ? 'Professor' : 'Aluno'}
          </p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs text-blue-200 hover:text-white px-2 py-1 rounded transition-colors"
          title="Sair"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
