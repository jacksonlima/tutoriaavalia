/**
 * PAGINA DE LOGIN DE DESENVOLVIMENTO
 * So funciona em NODE_ENV=development (npm run dev).
 * Acesso: http://localhost:3000/dev/login
 */

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // Bloqueia em producao
  if (process.env.NODE_ENV !== 'development') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400 mb-2">404</p>
          <p className="text-gray-400">Pagina nao encontrada.</p>
        </div>
      </main>
    )
  }

  const params  = await searchParams
  const errMsg  = params.error

  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ papel: 'asc' }, { nome: 'asc' }],
    select:  { id: true, nome: true, email: true, papel: true },
  })

  const tutores = usuarios.filter((u) => u.papel === 'TUTOR')
  const alunos  = usuarios.filter((u) => u.papel === 'ALUNO')

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Banner de aviso */}
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 text-lg">&#9888;</span>
            <span className="font-bold text-yellow-300">Ambiente de Desenvolvimento</span>
          </div>
          <p className="text-yellow-200 text-sm">
            Login sem Google OAuth — apenas para testes locais.
            Esta pagina nao existe em producao.
          </p>
        </div>

        {/* Erro */}
        {errMsg && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-3 mb-5 text-sm text-red-300">
            Erro ao fazer login: {errMsg}
          </div>
        )}

        <h1 className="text-xl font-bold mb-1">Login de Teste</h1>
        <p className="text-gray-400 text-sm mb-6">
          Clique em qualquer usuario para entrar como ele instantaneamente.
        </p>

        {/* Professores */}
        {tutores.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">
              Professores ({tutores.length})
            </h2>
            <div className="space-y-2">
              {tutores.map((u) => (
                <form key={u.id} action="/api/dev/login" method="POST">
                  <input type="hidden" name="email" value={u.email} />
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 rounded-xl px-4 py-3 text-left transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                      {u.nome.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{u.nome}</p>
                      <p className="text-blue-300 text-xs truncate">{u.email}</p>
                    </div>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0 group-hover:bg-blue-500">
                      Entrar
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

        {/* Alunos */}
        {alunos.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">
              Alunos ({alunos.length})
            </h2>
            <div className="space-y-2">
              {alunos.map((u, idx) => (
                <form key={u.id} action="/api/dev/login" method="POST">
                  <input type="hidden" name="email" value={u.email} />
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3 text-left transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-700 flex items-center justify-center shrink-0 font-bold text-sm">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{u.nome}</p>
                      <p className="text-gray-400 text-xs truncate">{u.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                      Entrar &#8594;
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

        {usuarios.length === 0 && (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">Nenhum usuario no banco.</p>
            <p className="text-gray-500 text-xs">
              Execute <code className="bg-gray-700 px-1.5 py-0.5 rounded font-mono">npm run db:seed</code> para criar os usuarios de teste.
            </p>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs mt-8">
          TutoriaAvalia — Modo Desenvolvimento
        </p>
      </div>
    </main>
  )
}
