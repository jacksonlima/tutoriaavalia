import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'

export default async function MobileCallbackPage() {
  const session = await auth()
  const cookieStore = await cookies()

  const sessionToken =
    cookieStore.get('authjs.session-token')?.value ??
    cookieStore.get('next-auth.session-token')?.value ??
    ''

  if (!session?.user || !sessionToken) {
    return (
      <html>
        <body>
          <script dangerouslySetInnerHTML={{
            __html: `window.location.href = 'tutoriaavalia://auth/callback?error=unauthorized'`
          }} />
          <p>Erro na autenticação. Volte ao app.</p>
        </body>
      </html>
    )
  }

  const token = encodeURIComponent(sessionToken)

  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content={`0;url=tutoriaavalia://auth/callback?token=${token}`} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{
          __html: `window.location.href = 'tutoriaavalia://auth/callback?token=${token}'`
        }} />
        <p style={{ fontFamily: 'system-ui', textAlign: 'center', marginTop: 60, color: '#555' }}>
          Redirecionando para o TutoriaAvalia...
        </p>
      </body>
    </html>
  )
}
