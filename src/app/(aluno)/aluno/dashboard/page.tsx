/**
 * Notas da Tutoria v2 — Dashboard do Aluno
 * Autor: Jackson Lima — CESUPA
 *
 * FIX CRÍTICO: usava findFirst (só 1 módulo) + campo .ativo inexistente.
 * Agora usa findMany e mostra TODOS os módulos ativos do aluno.
 */
import { auth }     from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link         from 'next/link'
import { TopBar }   from '@/components/ui/TopBar'

export const dynamic = 'force-dynamic'

export default async function AlunoDashboard() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'ALUNO') redirect('/login')

  // ── Busca TODOS os módulos ativos em que o aluno está matriculado ─────────
  // FIX: findMany (não findFirst) + filtra arquivado: false (não .ativo)
  const matriculas = await prisma.matricula.findMany({
    where: {
      usuarioId: session?.user?.id,
      modulo:    { arquivado: false },
    },
    include: {
      modulo: {
        include: {
          problemas: { orderBy: { numero: 'asc' } },
          tutor:     { select: { nome: true } },
        },
      },
    },
    orderBy: { numeraNaTurma: 'asc' },
  })

  const modulos = matriculas.map((m) => m.modulo)

  // ── Coleta IDs para queries em lote ──────────────────────────────────────
  const todosProbIds  = modulos.flatMap((m) => m.problemas.map((p) => p.id))
  const todosModuloIds = matriculas.map((m) => m.moduloId)

  // ── Submissões do aluno (todos os módulos) ────────────────────────────────
  const submissoes = todosProbIds.length > 0
    ? await prisma.submissao.findMany({
        where: { problemaId: { in: todosProbIds }, avaliadorId: session?.user?.id },
      })
    : []

  // ── Situações Excepcionais (todos os módulos) ─────────────────────────────
  const situacoesExcepcionais = todosModuloIds.length > 0
    ? await prisma.situacaoExcepcional.findMany({
        where: { alunoId: session?.user?.id, moduloOrigemId: { in: todosModuloIds } },
        include: {
          problemaDestino: {
            include: {
              modulo: {
                select: { nome: true, tutoria: true, turma: true, tutor: { select: { nome: true } } },
              },
            },
          },
        },
      })
    : []

  // Submissões em SEs (encontros externos)
  const problemasExternosIds = situacoesExcepcionais.map((e) => e.problemaDestinoId)
  const submissoesExternas = problemasExternosIds.length > 0
    ? await prisma.submissao.findMany({
        where: { problemaId: { in: problemasExternosIds }, avaliadorId: session?.user?.id },
      })
    : []

  // ── Helpers ───────────────────────────────────────────────────────────────
  const jaSubmeteu = (probId: string, tipo: string) =>
    submissoes.some((s) => s.problemaId === probId && s.tipoEncontro === tipo)

  // Mapa de SEs por módulo: chave = `${moduloId}:${tipo}:${probNumero}`
  const tiposDelegados = new Map(
    situacoesExcepcionais.map((ee) => [
      `${ee.moduloOrigemId}:${ee.tipoEncontro}:${ee.problemaDestino.numero}`,
      ee,
    ])
  )

  type Status = 'enviado' | 'aberto' | 'aguardando' | 'delegado'

  const statusEncontro = (
    moduloId: string,
    probId:   string,
    probNum:  number,
    tipo:     string,
    ativo:    boolean,
  ): Status => {
    if (jaSubmeteu(probId, tipo)) return 'enviado'
    if (tiposDelegados.has(`${moduloId}:${tipo}:${probNum}`) && ativo) return 'delegado'
    if (ativo) return 'aberto'
    return 'aguardando'
  }

  const renderBotao = (
    moduloId:    string,
    probId:      string,
    probNum:     number,
    tipo:        string,
    label:       string,
    ativo:       boolean,
    nomeProblem: string | null,
    corAberto?:  string,
  ) => {
    const st  = statusEncontro(moduloId, probId, probNum, tipo, ativo)
    const key = `${moduloId}:${tipo}:${probNum}`
    const href = `/aluno/avaliar?problemaId=${probId}&tipo=${tipo}&nome=${encodeURIComponent(nomeProblem ?? '')}`

    if (st === 'delegado') {
      const ee = tiposDelegados.get(key)!
      return (
        <div
          title={`Delegado: ${ee.problemaDestino.modulo.nome} · ${ee.problemaDestino.modulo.tutoria}`}
          className="w-full text-center text-xs font-medium px-2 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 cursor-default"
        >
          {label}: Delegado
        </div>
      )
    }
    if (st === 'aberto') {
      return (
        <Link
          href={href}
          className={`block w-full text-center text-xs font-medium px-2 py-2 rounded-lg ${corAberto ?? 'bg-blue-600 text-white'}`}
        >
          {label}
        </Link>
      )
    }
    if (st === 'enviado') {
      return (
        <Link
          href={href}
          className="block w-full text-center text-xs font-medium px-2 py-2 rounded-lg bg-green-100 text-green-700"
        >
          {label}: Enviado ✓
        </Link>
      )
    }
    return (
      <div className="w-full text-center text-xs font-medium px-2 py-2 rounded-lg bg-gray-100 text-gray-400">
        {label}: Aguardando
      </div>
    )
  }

  // ── SEs deste aluno agrupadas por módulo ──────────────────────────────────
  const sesPorModulo = new Map<string, typeof situacoesExcepcionais>()
  for (const ee of situacoesExcepcionais) {
    if (!sesPorModulo.has(ee.moduloOrigemId)) sesPorModulo.set(ee.moduloOrigemId, [])
    sesPorModulo.get(ee.moduloOrigemId)!.push(ee)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome} papel="ALUNO" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {modulos.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h1 className="text-xl font-bold text-gray-700 mb-2">Nenhum módulo ativo</h1>
            <p className="text-sm text-gray-400">Aguarde seu professor ativar um módulo.</p>
          </div>
        )}

        {modulos.map((modulo) => {
          const seDoModulo = sesPorModulo.get(modulo.id) ?? []

          return (
            <div key={modulo.id}>
              {/* Cabeçalho do módulo */}
              <div className="rounded-xl p-4 text-white mb-4" style={{ backgroundColor: '#1B2280' }}>
                <p className="text-xs mb-0.5" style={{ color: '#93C5FD' }}>Módulo Ativo</p>
                <h1 className="text-lg font-bold">{modulo.nome}</h1>
                <p className="text-sm mt-0.5" style={{ color: '#93C5FD' }}>
                  Tutor: {modulo.tutor.nome} · {modulo.tutoria} · Turma {modulo.turma} · {modulo.ano}
                </p>
              </div>

              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Seus Encontros
              </h2>

              <div className="space-y-3">
                {modulo.problemas.map((prob) => {
                  const encontrosFechamento = prob.temSaltoTriplo
                    ? [
                        { tipo: 'FECHAMENTO_A', label: 'Fechamento A', ativo: prob.fechamentoAAtivo },
                        { tipo: 'FECHAMENTO_B', label: 'Fechamento B', ativo: prob.fechamentoBAtivo },
                      ]
                    : [
                        { tipo: 'FECHAMENTO', label: 'Fechamento', ativo: prob.fechamentoAtivo },
                      ]

                  return (
                    <div key={prob.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="font-semibold text-gray-800 text-sm">
                          {prob.nome ?? `Problema ${String(prob.numero).padStart(2, '0')}`}
                        </p>
                        {prob.temSaltoTriplo && (
                          <span className="text-xs text-white px-1.5 py-0.5 rounded font-bold"
                            style={{ backgroundColor: '#1B2280' }}>ST</span>
                        )}
                      </div>
                      <div className={`grid gap-2 ${prob.temSaltoTriplo ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        {renderBotao(modulo.id, prob.id, prob.numero, 'ABERTURA', 'Abertura', prob.aberturaAtiva, prob.nome)}
                        {encontrosFechamento.map(({ tipo, label, ativo }) => (
                          <div key={tipo}>
                            {renderBotao(
                              modulo.id, prob.id, prob.numero, tipo, label, ativo, prob.nome,
                              prob.temSaltoTriplo ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white',
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Situações Excepcionais deste módulo */}
              {seDoModulo.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-base font-bold mb-1 flex items-center gap-2" style={{ color: '#1B2280' }}>
                    Situações Excepcionais
                  </h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Você foi redistribuído temporariamente para outra tutoria nestes encontros.
                  </p>
                  <div className="space-y-3">
                    {seDoModulo.map((ee) => {
                      const jaFez = submissoesExternas.some(
                        (s) => s.problemaId === ee.problemaDestinoId && s.tipoEncontro === ee.tipoEncontro
                      )
                      const prob = ee.problemaDestino
                      const mod  = prob.modulo
                      const label =
                        ee.tipoEncontro === 'ABERTURA'     ? 'Abertura'
                        : ee.tipoEncontro === 'FECHAMENTO'   ? 'Fechamento'
                        : ee.tipoEncontro === 'FECHAMENTO_A' ? 'Fechamento A'
                        : 'Fechamento B'

                      return (
                        <div key={ee.id} className="bg-white rounded-xl border border-amber-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                  Encontro Especial
                                </span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${jaFez ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {label}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-800">
                                P{prob.numero}{prob.nome ? ` — ${prob.nome}` : ''}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {mod.nome} · {mod.tutoria} · Turma {mod.turma}
                              </p>
                              <p className="text-xs text-gray-400">Prof. {mod.tutor.nome}</p>
                            </div>
                            {jaFez ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                                ✓ Enviado
                              </span>
                            ) : (
                              <Link
                                href={`/aluno/avaliar?problemaId=${prob.id}&tipo=${ee.tipoEncontro}&nome=${encodeURIComponent(prob.nome ?? '')}`}
                                className="text-xs text-white px-3 py-1.5 rounded-lg font-medium"
                                style={{ backgroundColor: '#3A50C8' }}
                              >
                                Avaliar →
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}
