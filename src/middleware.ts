import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// O middleware NUNCA deve usar Prisma — roda no Edge Runtime
// Usa apenas o JWT token que já contém o papel do usuário

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const { pathname } = nextUrl

  // ── Rotas que nunca são bloqueadas ──────────────────────────────
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/dev')  ||
    pathname.startsWith('/dev')      ||
    pathname.startsWith('/_next')    ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Lê o JWT diretamente — sem tocar no banco, sem Prisma
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isLoggedIn  = !!token
  const papel       = token?.papel as string | undefined
  const isLoginPage = pathname === '/login'

  // ── Não logado ────────────────────────────────────────────────
  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next()
    const url = new URL('/login', nextUrl.origin)
    if (!pathname.startsWith('/login')) {
      url.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(url)
  }

  // ── Logado na página de login → redireciona pro dashboard ─────
  if (isLoginPage) {
    if (papel === 'TUTOR') return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
    if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
    return NextResponse.next()
  }

  // ── Papel ainda não está no token (banco lento) → deixa passar ─
  if (!papel) {
    return NextResponse.next()
  }

  // ── Proteção por papel ────────────────────────────────────────
  if (pathname.startsWith('/professor') && papel !== 'TUTOR') {
    return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
  }

  if (pathname.startsWith('/aluno') && papel !== 'ALUNO') {
    return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
