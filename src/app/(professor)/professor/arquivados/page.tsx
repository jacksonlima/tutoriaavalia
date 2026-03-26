import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/ui/TopBar'

export const dynamic = 'force-dynamic'

export default async function ModulosArquivadosPage() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') redirect('/login')

  const modulos = await prisma.modulo.findMany({
    where:   { tutorId: session.user.id, arquivado: true },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matrículas: {
        include: { usuario: { select: { id: true, nome: true } } },
        orderBy: { numeraNaTurma: 'asc' },
      },
      _count: { select: { matrículas: true } },
    },
    orderBy: { atualizadoEm: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session.user.nome} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#1F4E79]">Módulos Arquivados</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {modulos.length === 0
                ? 'Nenhum módulo arquivado'
                : `${modulos.length} módulo${modulos.length > 1 ? 's' : ''} arquivado${modulos.length > 1 ? 's' : ''}`}
            </p>
          </div>

        </div>

        {modulos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <h2 className="font-semibold text-gray-700 mb-1">Nenhum módulo arquivado</h2>
            <p className="text-sm text-gray-400">
              Quando você arquivar um módulo no painel, ele aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {modulos.map((modulo) => (
              <div key={modulo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-80">
                {/* Cabeçalho */}
                <div className="p-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-gray-700 text-sm">{modulo.nome}</h2>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Arquivado
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {modulo.ano} · {modulo.tutoria} · Turma {modulo.turma} · {modulo._count.matrículas} alunos
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {modulo.problemas.length} problema{modulo.problemas.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-2 shrink-0 ml-4">
                    <Link
                      href={`/professor/relatorios?moduloId=${modulo.id}`}
                      className="text-xs border border-[#1F4E79] text-[#1F4E79] px-3 py-1.5 rounded-lg hover:bg-[#1F4E79] hover:text-white transition-colors"
                    >
                      Ver Relatório
                    </Link>
                    <DesarquivarBtn moduloId={modulo.id} />
                  </div>
                </div>

                {/* Lista resumida de alunos */}
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1.5">Alunos:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {modulo.matrículas.map((m) => (
                      <span key={m.id} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                        {m.usuario.nome}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Componente client-side para o botão Desarquivar
function DesarquivarBtn({ moduloId }: { moduloId: string }) {
  return (
    <form
      action={async () => {
        'use server'
        // Chama a API para desarquivar (ativo=true, arquivado=false)
        const { auth: authFn } = await import('@/lib/auth')
        const { prisma: db }   = await import('@/lib/db')
        const session = await authFn()
        if (!session || session.user.papel !== 'TUTOR') return

        const modulo = await db.modulo.findUnique({ where: { id: moduloId } })
        if (!modulo || modulo.tutorId !== session.user.id) return

        await db.modulo.update({
          where: { id: moduloId },
          data:  { arquivado: false, ativo: true },
        })
      }}
    >
      <button
        type="submit"
        className="text-xs border border-green-500 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
      >
        Desarquivar
      </button>
    </form>
  )
}
