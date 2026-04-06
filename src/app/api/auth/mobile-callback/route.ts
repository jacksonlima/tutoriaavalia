import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Chamado pelo NextAuth após o login Google no app mobile.
// Redireciona de volta ao app com o token de sessão na URL.
export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    // Redireciona pro app com erro
    return NextResponse.redirect('tutoriaavalia://auth/callback?error=unauthorized')
  }

  // Pega o cookie de sessão que o NextAuth já criou
  const cookieHeader = req.headers.get('cookie') ?? ''
  const sessionToken =
    cookieHeader.match(/authjs\.session-token=([^;]+)/)?.[1] ??
    cookieHeader.match(/next-auth\.session-token=([^;]+)/)?.[1] ??
    ''

  if (!sessionToken) {
    return NextResponse.redirect('tutoriaavalia://auth/callback?error=no_token')
  }

  // Redireciona para o app com o token
  return NextResponse.redirect(
    `tutoriaavalia://auth/callback?token=${encodeURIComponent(sessionToken)}`
  )
}
