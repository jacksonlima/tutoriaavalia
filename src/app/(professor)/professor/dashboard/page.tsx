// src/app/(professor)/professor/dashboard/page.tsx

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db' // <-- Trazido para o topo de forma global e cacheada
import { ModuloCard } from '@/components/professor/ModuloCard'
import { TopBar } from '@/components/ui/TopBar'

// Força a página a sempre buscar dados novos (nunca exibe cache obsoleto do professor)
export const dynamic = 'force-dynamic'

export default async function ProfessorDashboard() {
  const session = await auth()
  
  // Barreira de Segurança
  if (!session || session?.user?.papel !== 'TUTOR') redirect('/login')

  // O Prisma executará estas buscas diretamente na Vercel (Server Side)
  const include = {
    problemas: { orderBy: { numero: 'asc' } },
    _count: { select: { matriculas: true } },
  } as const

  // 1. Módulos onde é titular
  const modulosTitular = await prisma.modulo.findMany({
    where:   { tutorId: session?.user?.id, arquivado: false },
    include,
    orderBy: { criadoEm: 'desc' },
  })

  // 2. Módulos onde é co-tutor (substituto)
  const coTutorEm = await prisma.coTutor.findMany({
    where:   { tutorId: session?.user?.id },
    include: {
      modulo: {
        include: {
          ...include,
          tutor: { select: { nome: true } },
        },
      },
    },
  })

  // Filtra apenas módulos ativos e não arquivados onde é substituto
  const modulosSubstituto = coTutorEm
    .map((ct) => ct.modulo)
    .filter((m) => !m.arquivado)

  const totalModulos = modulosTitular.length + modulosSubstituto.length

  // HTML entregue pronto para o celular do usuário, sem telas de "Carregando..." vazias
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome} papel="TUTOR" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#1F4E79]">Meus Módulos</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalModulos === 0
                ? 'Nenhum módulo disponível'
                : `${totalModulos} módulo${totalModulos > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/professor/arquivados"
              className="border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              📦 Arquivados
            </Link>
            <Link
              href="/professor/modulos/novo"
              className="bg-[#1F4E79] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#163d61] transition-colors"
            >
              + Novo Módulo
            </Link>
          </div>
        </div>

        {totalModulos === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <h2 className="font-semibold text-gray-700 mb-1">Nenhum módulo disponível</h2>
            <p className="text-sm text-gray-400 mb-4">
              Crie seu primeiro módulo ou aguarde ser adicionado como substituto.
            </p>
            <Link
              href="/professor/modulos/novo"
              className="inline-block bg-[#1F4E79] text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              Criar Módulo
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Módulos onde é titular */}
            {modulosTitular.map((modulo) => (
              <ModuloCard key={modulo.id} modulo={modulo} isTitular={true} />
            ))}

            {/* Módulos onde é substituto */}
            {modulosSubstituto.length > 0 && (
              <>
                {modulosTitular.length > 0 && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                      Como Substituto
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                {modulosSubstituto.map((modulo) => (
                  // O typescript às vezes chora com tipos complexos retornados pelo Prisma, o 'as any' previne erros de compilação aqui
                  <ModuloCard key={modulo.id} modulo={modulo as any} isTitular={false} />
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}