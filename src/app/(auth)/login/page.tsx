import { auth, signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const params = await searchParams
  const session = await auth()

  if (session?.user?.papel === 'TUTOR') redirect('/professor/dashboard')
  if (session?.user?.papel === 'ALUNO') redirect('/aluno/dashboard')

  const raw = params.callbackUrl ?? ''
  const safeCallback =
    raw.startsWith('/') &&
    !raw.startsWith('/login') &&
    !raw.startsWith('/api') &&
    raw !== '/'
      ? raw
      : '/professor/dashboard'

  const erro = params.error

  return (
    <main className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1B2280 0%, #3A50C8 100%)' }}>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">

        {/* Logo NT — paleta CESUPA */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#1B2280' }}>
            <span className="text-white text-2xl font-bold tracking-tight">NT</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2280' }}>
            Notas da Tutoria
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Sistema de Avaliação Formativa — PBL
          </p>
          <p className="text-xs mt-1 font-medium" style={{ color: '#26C6DA' }}>
            CESUPA · Medicina
          </p>
        </div>

        {/* Mensagens de erro */}
        {erro === 'AccessDenied' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-sm text-red-700">
            <p className="font-semibold mb-1">Acesso negado</p>
            <p>Apenas emails do domínio autorizado podem acessar. Verifique se está usando o email institucional correto.</p>
          </div>
        )}
        {erro === 'DatabaseError' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6 text-sm text-orange-700">
            <p className="font-semibold mb-1">Erro de conexão</p>
            <p>Não foi possível conectar ao banco de dados.</p>
          </div>
        )}
        {erro && erro !== 'AccessDenied' && erro !== 'DatabaseError' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-sm text-red-700">
            Erro ao entrar: <span className="font-mono">{erro}</span>. Tente novamente.
          </div>
        )}

        {/* Botão de login */}
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: safeCallback })
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <p className="text-xs text-gray-500 text-center">
            Use apenas o e-mail institucional da sua organização.
          </p>
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Ao entrar, você concorda com nossa{' '}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer"
              className="underline hover:opacity-80" style={{ color: '#3A50C8' }}>
              Política de Privacidade
            </a>{' '}
            e o tratamento dos seus dados conforme a LGPD.
          </p>
        </div>
      </div>
    </main>
  )
}
