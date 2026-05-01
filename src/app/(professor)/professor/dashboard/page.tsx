// src/app/(professor)/professor/dashboard/page.tsx

import { auth }       from '@/lib/auth'
import { redirect }   from 'next/navigation'
import Link           from 'next/link'
import { prisma }     from '@/lib/db'
import { ModuloCard } from '@/components/professor/ModuloCard'
import { TopBar }     from '@/components/ui/TopBar'

export const dynamic = 'force-dynamic'

export default async function ProfessorDashboard() {
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') redirect('/login')

  const userId = session?.user?.id!

  // Include base para módulos
  const includeBase = {
    problemas:   { orderBy: { numero: 'asc' } },
    _count:      { select: { matriculas: true } },
  } as const

  // 1. Módulos onde é TITULAR
  const modulosTitular = await prisma.modulo.findMany({
    where:   { tutorId: userId, arquivado: false },
    include: includeBase,
    orderBy: { criadoEm: 'desc' },
  })

  // 2. Módulos onde é CO-TUTOR
  // Busca permissões agrupando por módulo (evita duplicatas)
  const coTutorPerms = await prisma.coTutorPermissao.findMany({
    where:   { tutorId: userId },
    include: {
      modulo: {
        include: {
          ...includeBase,
          tutor: { select: { nome: true } },
        },
      },
    },
  })

  // Deduplica módulos (um co-tutor pode ter N permissões no mesmo módulo)
  // e constrói mapa de permissões por problema para cada módulo
  const modulosMap = new Map<string, any>()
  const permsMap   = new Map<string, Map<string, Set<string>>>()
  // permsMap: moduloId → Map<problemaId → Set<tipoEncontro>>

  for (const p of coTutorPerms) {
    const m = p.modulo
    if (m.arquivado) continue

    if (!modulosMap.has(m.id)) {
      modulosMap.set(m.id, m)
      permsMap.set(m.id, new Map())
    }

    const probMap = permsMap.get(m.id)!
    if (!probMap.has(p.problemaId)) {
      probMap.set(p.problemaId, new Set())
    }
    probMap.get(p.problemaId)!.add(p.tipoEncontro)
  }

  // Monta lista de módulos do co-tutor com _permissoesCoTutor em cada problema
  const modulosSubstituto = [...modulosMap.values()].map((modulo) => {
    const probMap = permsMap.get(modulo.id) ?? new Map()

    const problemasComPerms = modulo.problemas.map((prob: any) => {
      const tiposPermitidos = probMap.get(prob.id) ?? new Set()
      return {
        ...prob,
        _permissoesCoTutor: {
          abertura:    tiposPermitidos.has('ABERTURA'),
          fechamento:  tiposPermitidos.has('FECHAMENTO'),
          fechamentoA: tiposPermitidos.has('FECHAMENTO_A'),
          fechamentoB: tiposPermitidos.has('FECHAMENTO_B'),
        },
      }
    })

    // Filtra só problemas que têm ao menos uma permissão
    const problemasVisiveis = problemasComPerms.filter((p: any) =>
      p._permissoesCoTutor.abertura   ||
      p._permissoesCoTutor.fechamento ||
      p._permissoesCoTutor.fechamentoA ||
      p._permissoesCoTutor.fechamentoB
    )

    return { ...modulo, problemas: problemasVisiveis }
  })

  const totalModulos = modulosTitular.length + modulosSubstituto.length

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
            {/* Módulos onde é TITULAR */}
            {modulosTitular.map((modulo) => (
              <ModuloCard key={modulo.id} modulo={modulo as any} isTitular={true} />
            ))}

            {/* Módulos onde é SUBSTITUTO */}
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
