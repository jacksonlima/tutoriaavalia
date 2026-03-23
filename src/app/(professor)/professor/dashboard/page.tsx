import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ModuloCard } from '@/components/professor/ModuloCard'
import { TopBar } from '@/components/ui/TopBar'

export const dynamic = 'force-dynamic'

export default async function ProfessorDashboard() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') redirect('/login')

  const modulos = await prisma.modulo.findMany({
    where: { tutorId: session.user.id, arquivado: false },
    include: {
      problemas: { orderBy: { numero: 'asc' } },
      _count: { select: { matriculas: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session.user.nome} papel="TUTOR" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#1F4E79]">Meus Módulos</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {modulos.length === 0
                ? 'Nenhum módulo criado ainda'
                : `${modulos.length} módulo${modulos.length > 1 ? 's' : ''}`}
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

        {modulos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <h2 className="font-semibold text-gray-700 mb-1">Nenhum módulo criado</h2>
            <p className="text-sm text-gray-400 mb-4">
              Crie seu primeiro módulo para começar a avaliar os alunos.
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
            {modulos.map((modulo) => (
              <ModuloCard key={modulo.id} modulo={modulo} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
