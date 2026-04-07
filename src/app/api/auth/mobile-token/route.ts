import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'

// Middleware pula /api/ — este route faz redirect direto para o scheme do app.
// Usa Response raw para evitar que o Next.js valide/bloqueie o scheme customizado.
export async function GET() {
  const session    = await auth()
  const cookieStore = await cookies()

  const token =
    cookieStore.get('authjs.session-token')?.value ??
    cookieStore.get('next-auth.session-token')?.value ??
    ''

  if (!session?.user || !token) {
    return new Response(null, {
      status: 302,
      headers: { Location: 'tutoriaavalia://auth/callback?error=unauthorized' },
    })
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `tutoriaavalia://auth/callback?token=${encodeURIComponent(token)}`,
    },
  })
}
