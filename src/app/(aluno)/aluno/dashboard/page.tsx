import { auth }     from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link         from 'next/link'
import { TopBar }   from '@/components/ui/TopBar'

export const dynamic = 'force-dynamic'

export default async function AlunoDashboard() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'ALUNO') redirect('/login')

  const matricula = await prisma.matricula.findFirst({
    where: { usuarioId: session?.user?.id },
    include: {
      modulo: {
        include: {
          problemas: { orderBy: { numero: 'asc' } },
          tutor:     { select: { nome: true } },
        },
      },
    },
  })

  const modulo = matricula?.modulo?.ativo ? matricula.modulo : null

  if (!modulo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome} papel="ALUNO" />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🎓</div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">Nenhum módulo ativo</h1>
          <p className="text-sm text-gray-400">Aguarde seu professor ativar um módulo.</p>
        </main>
      </div>
    )
  }

  const problemasIds = modulo.problemas.map((p) => p.id)

  // Submissões no módulo de origem (encontros normais)
  const submissoes = await prisma.submissao.findMany({
    where: { problemaId: { in: problemasIds }, avaliadorId: session?.user?.id },
  })

  // Situações Excepcionais deste aluno neste módulo
  const situacoesExcepcionais = await prisma.situacaoExcepcional.findMany({
    where: { alunoId: session?.user?.id, moduloOrigemId: matricula.moduloId },
    include: {
      problemaDestino: {
        include: {
          modulo: {
            select: {
              nome:    true,
              tutoria: true,
              turma:   true,
              tutor:   { select: { nome: true } },
            },
          },
        },
      },
    },
  })

  // ── CORREÇÃO: chave = "TIPO:numeroProblemaDestino" ────────────────────────
  // Antes era só "TIPO" (ex: "ABERTURA"), o que fazia TODAS as aberturas
  // de todos os problemas ficarem como "Delegado".
  // Agora só o problema cujo número coincide com o destino fica delegado.
  const tiposDelegados = new Map(
    situacoesExcepcionais.map((ee) => [
      `${ee.tipoEncontro}:${ee.problemaDestino.numero}`,
      ee,
    ])
  )

  // Submissões nas situações excepcionais (para saber se já avaliou lá fora)
  const problemasExternosIds = situacoesExcepcionais.map((e) => e.problemaDestinoId)
  const submissoesExternas   = problemasExternosIds.length > 0
    ? await prisma.submissao.findMany({
        where: { problemaId: { in: problemasExternosIds }, avaliadorId: session?.user?.id },
      })
    : []

  const jaSubmeteu = (probId: string, tipo: string) =>
    submissoes.some((s) => s.problemaId === probId && s.tipoEncontro === tipo)

  // Status de um encontro — recebe também o número do problema para checar delegação correta
  type Status = 'enviado' | 'aberto' | 'aguardando' | 'delegado'

  const statusEncontro = (
    probId:     string,
    probNumero: number,        // ← necessário para chave correta
    tipo:       string,
    ativo:      boolean,
  ): Status => {
    if (jaSubmeteu(probId, tipo)) return 'enviado'
    // Só é "delegado" se o número do problema coincide com o destino da SE
    if (tiposDelegados.has(`${tipo}:${probNumero}`) && ativo) return 'delegado'
    if (ativo) return 'aberto'
    return 'aguardando'
  }

  const renderBotao = (
    probId:      string,
    probNumero:  number,       // ← passado para statusEncontro
    tipo:        string,
    label:       string,
    ativo:       boolean,
    nomeProblem: string | null,
    corAberto?:  string,
  ) => {
    const st = statusEncontro(probId, probNumero, tipo, ativo)

    if (st === 'delegado') {
      const ee = tiposDelegados.get(`${tipo}:${probNumero}`)!
      return (
        <div
          title={`Delegado para: ${ee.problemaDestino.modulo.nome} · ${ee.problemaDestino.modulo.tutoria}`}
          className="w-full text-center text-xs font-medium px-2 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 cursor-default"
        >
          🔄 {label}: Delegado
        </div>
      )
    }

    if (st === 'aberto') {
      return (
        <Link
          href={`/aluno/avaliar?problemaId=${probId}&tipo=${tipo}&nome=${encodeURIComponent(nomeProblem ?? '')}`}
          className={`block w-full text-center text-xs font-medium px-2 py-2 rounded-lg ${corAberto ?? 'bg-blue-600 text-white'}`}
        >
          {label}
        </Link>
      )
    }

    if (st === 'enviado') {
      return (
        <Link
          href={`/aluno/avaliar?problemaId=${probId}&tipo=${tipo}&nome=${encodeURIComponent(nomeProblem ?? '')}`}
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

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome} papel="ALUNO" />
      <main className="max-w-lg mx-auto px-4 py-6">

        {/* Cabeçalho do módulo */}
        <div className="bg-[#1F4E79] rounded-xl p-4 text-white mb-5">
          <p className="text-xs text-blue-200 mb-0.5">Módulo Ativo</p>
          <h1 className="text-lg font-bold">{modulo.nome}</h1>
          <p className="text-sm text-blue-200 mt-0.5">
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
                    {prob.nome ?? ('Problema ' + String(prob.numero).padStart(2, '0'))}
                  </p>
                  {prob.temSaltoTriplo && (
                    <span className="text-xs bg-[#1F4E79] text-white px-1.5 py-0.5 rounded font-bold">ST</span>
                  )}
                </div>

                <div className={`grid gap-2 ${prob.temSaltoTriplo ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {renderBotao(prob.id, prob.numero, 'ABERTURA', 'Abertura', prob.aberturaAtiva, prob.nome)}
                  {encontrosFechamento.map(({ tipo, label, ativo }) => (
                    <div key={tipo}>
                      {renderBotao(
                        prob.id, prob.numero, tipo, label, ativo, prob.nome,
                        prob.temSaltoTriplo ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white',
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Situações Excepcionais ─────────────────────────────────────── */}
        {situacoesExcepcionais.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-bold text-[#1F4E79] mb-1 flex items-center gap-2">
              🔄 Situações Excepcionais
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Você foi redistribuído temporariamente para outra tutoria nestes encontros.
              Sua nota será calculada normalmente e registrada no seu módulo de origem.
            </p>
            <div className="space-y-3">
              {situacoesExcepcionais.map((ee) => {
                const jaFez = submissoesExternas.some(
                  (s) =>
                    s.problemaId   === ee.problemaDestinoId &&
                    s.tipoEncontro === ee.tipoEncontro
                )
                const prob  = ee.problemaDestino
                const mod   = prob.modulo
                const label =
                  ee.tipoEncontro === 'ABERTURA'    ? 'Abertura'
                  : ee.tipoEncontro === 'FECHAMENTO'   ? 'Fechamento'
                  : ee.tipoEncontro === 'FECHAMENTO_A' ? 'Fechamento A'
                  : 'Fechamento B'

                return (
                  <div
                    key={ee.id}
                    className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            Encontro Especial
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            jaFez ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {jaFez ? '✓ Enviado' : '● Aberto'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {label} — P{String(prob.numero).padStart(2, '0')}
                          {prob.nome ? ` — ${prob.nome}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {mod.nome} · {mod.tutoria} · Turma {mod.turma} · Prof. {mod.tutor.nome}
                        </p>
                        {ee.observacao && (
                          <p className="text-xs text-gray-400 italic mt-1">{ee.observacao}</p>
                        )}
                      </div>
                      {!jaFez && (
                        <a
                          href={`/aluno/avaliar?problemaId=${ee.problemaDestinoId}&tipo=${ee.tipoEncontro}&externo=1`}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap"
                        >
                          Avaliar →
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
