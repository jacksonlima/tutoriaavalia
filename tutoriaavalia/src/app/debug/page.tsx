// Página de diagnóstico — REMOVA em produção
// Acesse: http://localhost:3000/debug
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function DebugPage() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  let dbUser = null
  let dbError = null

  if (session?.user?.email) {
    try {
      dbUser = await prisma.usuario.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, nome: true, papel: true },
      })
    } catch (e: any) {
      dbError = e.message
    }
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
        🔍 Diagnóstico de Sessão
      </h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Sessão NextAuth</h2>
        <pre style={{
          background: '#f3f4f6', padding: '1rem',
          borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto'
        }}>
          {JSON.stringify(session, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Usuário no Banco</h2>
        {dbError ? (
          <pre style={{ background: '#fef2f2', color: '#dc2626', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
            ERRO: {dbError}
          </pre>
        ) : (
          <pre style={{
            background: '#f0fdf4', padding: '1rem',
            borderRadius: '8px', fontSize: '0.8rem'
          }}>
            {JSON.stringify(dbUser, null, 2)}
          </pre>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Status</h2>
        <ul style={{ fontSize: '0.9rem', lineHeight: '2' }}>
          <li>Logado: <strong>{session ? '✅ SIM' : '❌ NÃO'}</strong></li>
          <li>Email: <strong>{session?.user?.email ?? '—'}</strong></li>
          <li>Papel no token: <strong>{session?.user?.papel ?? '⚠️ UNDEFINED'}</strong></li>
          <li>Papel no banco: <strong>{dbUser?.papel ?? (dbError ? '❌ ERRO BD' : '—')}</strong></li>
          <li>ID: <strong>{session?.user?.id ?? '—'}</strong></li>
        </ul>
      </section>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <a href="/login" style={{ color: '#1F4E79' }}>← Login</a>
        <a href="/professor/dashboard" style={{ color: '#1F4E79' }}>Dashboard Professor</a>
        <a href="/aluno/dashboard" style={{ color: '#1F4E79' }}>Dashboard Aluno</a>
      </div>
    </main>
  )
}
