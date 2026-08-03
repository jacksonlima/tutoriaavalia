/**
 * Notas da Tutoria v2 — Página: Módulos Arquivados
 * Autor: Jackson Lima — CESUPA
 *
 * Exibe módulos arquivados do tutor com opções de:
 *   - Reativar (desarquivar)
 *   - Excluir permanentemente (com confirmação)
 */
import { auth }     from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link         from 'next/link'
import { TopBar }   from '@/components/ui/TopBar'
import { DeleteModuloButton } from '@/components/ui/DeleteModuloButton'

export const dynamic = 'force-dynamic'

export default async function ModulosArquivadosPage() {
  const { prisma } = await import('@/lib/db')
  const session    = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') redirect('/login')

  const modulos = await prisma.modulo.findMany({
    where:   { tutorId: session?.user?.id, arquivado: true },
    include: {
      problemas:  { orderBy: { numero: 'asc' } },
      matriculas: {
        include: { usuario: { select: { id: true, nome: true } } },
        orderBy: { numeraNaTurma: 'asc' },
      },
      _count: { select: { matriculas: true } },
    },
    orderBy: { atualizadoEm: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        nome={session?.user?.nome}
        papel="TUTOR"
        backHref="/professor/dashboard"
        backLabel="Voltar ao painel"
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1B2280' }}>
              Módulos Arquivados
            </h1>
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
              <div
                key={modulo.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Cabeçalho do módulo */}
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        📦 Arquivado
                      </span>
                      <span className="text-xs text-gray-400">
                        {modulo.tutoria} · Turma {modulo.turma} · {modulo.ano}
                      </span>
                    </div>
                    <h2 className="font-bold text-gray-800 truncate">{modulo.nome}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {modulo._count.matriculas} aluno{modulo._count.matriculas !== 1 ? 's' : ''} ·{' '}
                      {modulo.problemas.length} problema{modulo.problemas.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Botão Reativar */}
                    <form action={async () => {
                      'use server'
                      const { prisma: db } = await import('@/lib/db')
                      await db.modulo.update({
                        where: { id: modulo.id },
                        data:  { arquivado: false },
                      })
                      const { revalidatePath } = await import('next/cache')
                      revalidatePath('/professor/arquivados')
                      revalidatePath('/professor/dashboard')
                    }}>
                      <button
                        type="submit"
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors text-white"
                        style={{ backgroundColor: '#1B2280', borderColor: '#1B2280' }}
                      >
                        Reativar
                      </button>
                    </form>

                    {/* Botão Excluir (client component com modal) */}
                    <DeleteModuloButton
                      moduloId={modulo.id}
                      moduloNome={modulo.nome}
                    />
                  </div>
                </div>

                {/* Lista de problemas */}
                {modulo.problemas.length > 0 && (
                  <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {modulo.problemas.map((p) => (
                        <span
                          key={p.id}
                          className="text-xs bg-gray-50 border border-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                        >
                          P{p.numero}{p.nome ? ` — ${p.nome}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de alunos (colapsada) */}
                {modulo.matriculas.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="text-xs text-gray-400 mb-1.5">Alunos matriculados:</p>
                    <div className="flex flex-wrap gap-1">
                      {modulo.matriculas.slice(0, 8).map((mat) => (
                        <span
                          key={mat.usuario.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                        >
                          {mat.usuario.nome.split(' ')[0]}
                        </span>
                      ))}
                      {modulo.matriculas.length > 8 && (
                        <span className="text-xs text-gray-400 px-1">
                          +{modulo.matriculas.length - 8} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Aviso sobre exclusão */}
        {modulos.length > 0 && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            A exclusão remove permanentemente todos os dados do módulo, incluindo avaliações e notas.
          </p>
        )}
      </main>
    </div>
  )
}
