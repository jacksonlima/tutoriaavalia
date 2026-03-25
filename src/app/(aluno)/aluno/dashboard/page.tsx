import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/ui/TopBar'

export const dynamic = 'force-dynamic'

export default async function AlunoDashboard() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'ALUNO') redirect('/login')

  const matricula = await prisma.matricula.findFirst({
    where: { usuarioId: session.user.id },
    include: {
      modulo: {
        include: {
          problemas: { orderBy: { numero: 'asc' } },
          tutor: { select: { nome: true } },
        },
      },
    },
  })

  const modulo = matricula?.modulo?.ativo ? matricula.modulo : null

  if (!modulo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session.user.nome} papel="ALUNO" />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🎓</div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">Nenhum modulo ativo</h1>
          <p className="text-sm text-gray-400">Aguarde seu professor ativar um modulo.</p>
        </main>
      </div>
    )
  }

  const problemasIds = modulo.problemas.map((p) => p.id)
  const submissoes   = await prisma.submissao.findMany({
    where: { problemaId: { in: problemasIds }, avaliadorId: session.user.id },
  })

  // Encontros especiais: este aluno foi redistribuído para outro módulo
  const encontrosEspeciais = await prisma.encontroEspecial.findMany({
    where: { alunoId: session.user.id, moduloOrigemId: matricula.moduloId },
    include: {
      problemaDestino: {
        include: {
          modulo: { select: { nome: true, tutoria: true, turma: true, tutor: { select: { nome: true } } } },
        },
      },
    },
  })

  // Submissões dos encontros especiais
  const problemasExternosIds = encontrosEspeciais.map((e) => e.problemaDestinoId)
  const submissoesExternas = problemasExternosIds.length > 0
    ? await prisma.submissao.findMany({
        where: { problemaId: { in: problemasExternosIds }, avaliadorId: session.user.id },
      })
    : []

  const jaSubmeteu = (probId: string, tipo: string) =>
    submissoes.some((s) => s.problemaId === probId && s.tipoEncontro === tipo)

  type Status = 'enviado' | 'aberto' | 'aguardando'
  const statusEncontro = (probId: string, tipo: string, ativo: boolean): Status => {
    if (jaSubmeteu(probId, tipo)) return 'enviado'
    if (ativo) return 'aberto'
    return 'aguardando'
  }

  const estiloStatus: Record<Status, string> = {
    enviado:    'bg-green-100 text-green-700',
    aberto:     'bg-blue-100 text-blue-700',
    aguardando: 'bg-gray-100 text-gray-400',
  }
  const labelStatus: Record<Status, string> = {
    enviado:    'Enviado',
    aberto:     'Avaliar',
    aguardando: 'Aguardando',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session.user.nome} papel="ALUNO" />
      <main className="max-w-lg mx-auto px-4 py-6">

        <div className="bg-[#1F4E79] rounded-xl p-4 text-white mb-5">
          <p className="text-xs text-blue-200 mb-0.5">Modulo Ativo</p>
          <h1 className="text-lg font-bold">{modulo.nome}</h1>
          <p className="text-sm text-blue-200 mt-0.5">
            Tutor: {modulo.tutor.nome} - {modulo.tutoria} - Turma {modulo.turma} - {modulo.ano}
          </p>
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Seus Encontros
        </h2>

        <div className="space-y-3">
          {modulo.problemas.map((prob) => {
            const stAb = statusEncontro(prob.id, 'ABERTURA', prob.aberturaAtiva)

            // Salto Triplo: mostra Fe A e Fe B; caso contrario, mostra Fe normal
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
                    {prob.nome ?? ("Problema " + String(prob.numero).padStart(2, "0"))}
                  </p>
                  {prob.temSaltoTriplo && (
                    <span className="text-xs bg-[#1F4E79] text-white px-1.5 py-0.5 rounded font-bold">ST</span>
                  )}
                </div>

                <div className={"grid gap-2 " + (prob.temSaltoTriplo ? "grid-cols-3" : "grid-cols-2")}>
                  {/* Abertura */}
                  {stAb === 'aberto' ? (
                    <Link href={"/aluno/avaliar?problemaId=" + prob.id + "&tipo=ABERTURA&nome=" + encodeURIComponent(prob.nome ?? '')}
                      className="block w-full text-center bg-blue-600 text-white text-xs font-medium px-2 py-2 rounded-lg">
                      Abertura
                    </Link>
                  ) : stAb === 'enviado' ? (
                    <Link href={"/aluno/avaliar?problemaId=" + prob.id + "&tipo=ABERTURA&nome=" + encodeURIComponent(prob.nome ?? '')}
                      className={"block w-full text-center text-xs font-medium px-2 py-2 rounded-lg " + estiloStatus[stAb]}>
                      Abertura: Enviado ✓
                    </Link>
                  ) : (
                    <div className={"w-full text-center text-xs font-medium px-2 py-2 rounded-lg " + estiloStatus[stAb]}>
                      Abertura: Aguardando
                    </div>
                  )}

                  {/* Fechamento(s) */}
                  {encontrosFechamento.map(({ tipo, label, ativo }) => {
                    const st = statusEncontro(prob.id, tipo, ativo)
                    if (st === 'aberto') {
                      return (
                        <Link key={tipo}
                          href={"/aluno/avaliar?problemaId=" + prob.id + "&tipo=" + tipo + "&nome=" + encodeURIComponent(prob.nome ?? '')}
                          className={"block w-full text-center text-xs font-medium px-2 py-2 rounded-lg " + (prob.temSaltoTriplo ? "bg-amber-500 text-white" : "bg-blue-600 text-white")}>
                          {label}
                        </Link>
                      )
                    }
                    if (st === 'enviado') {
                      return (
                        <Link key={tipo}
                          href={"/aluno/avaliar?problemaId=" + prob.id + "&tipo=" + tipo + "&nome=" + encodeURIComponent(prob.nome ?? '')}
                          className={"block w-full text-center text-xs font-medium px-2 py-2 rounded-lg " + estiloStatus[st]}>
                          {label}: Enviado ✓
                        </Link>
                      )
                    }
                    return (
                      <div key={tipo} className={"w-full text-center text-xs font-medium px-2 py-2 rounded-lg " + estiloStatus[st]}>
                        {label}: Aguardando
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Encontros Especiais ────────────────────────────────── */}
        {encontrosEspeciais.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-bold text-[#1F4E79] mb-3 flex items-center gap-2">
              🔄 Encontros Especiais
              <span className="text-xs font-normal text-gray-400">
                — você foi incluído temporariamente em outra tutoria
              </span>
            </h2>
            <div className="space-y-3">
              {encontrosEspeciais.map((ee) => {
                const jaFez = submissoesExternas.some(
                  (s) => s.problemaId === ee.problemaDestinoId && s.tipoEncontro === ee.tipoEncontro
                )
                const prob  = ee.problemaDestino
                const mod   = prob.modulo
                const label = ee.tipoEncontro === 'ABERTURA' ? 'Abertura'
                  : ee.tipoEncontro === 'FECHAMENTO'   ? 'Fechamento'
                  : ee.tipoEncontro === 'FECHAMENTO_A' ? 'Fechamento A'
                  : 'Fechamento B'

                return (
                  <div key={ee.id}
                    className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            Encontro Especial
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            jaFez ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {jaFez ? '✓ Enviado' : '● Aguardando'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {label} — Prob. {prob.numero}{prob.nome ? ` — ${prob.nome}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {mod.nome} · {mod.tutoria} · Turma {mod.turma} · Prof. {mod.tutor.nome}
                        </p>
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
