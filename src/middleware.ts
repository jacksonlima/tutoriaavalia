import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const { pathname } = nextUrl

  // ── Rotas públicas — nunca bloqueadas ───────────────────────────
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/dev')  ||
    pathname.startsWith('/api/')     ||
    pathname.startsWith('/dev')      ||
    pathname.startsWith('/_next')    ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Lê o JWT — sem Prisma, sem banco
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isLoggedIn  = !!token
  const papel       = token?.papel as string | undefined
  const isLoginPage = pathname === '/login'

  // ── Não logado → vai para o login ─────────────────────────────
  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next()
    const url = new URL('/login', nextUrl.origin)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // ── Logado na página de login → redireciona pro dashboard ──────
  if (isLoginPage) {
    if (papel === 'TUTOR') return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
    if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
    // Papel ainda não carregado → deixa passar (a página vai resolver)
    return NextResponse.next()
  }

  // ── Sem papel no token → deixa passar (banco ainda carregando) ──
  if (!papel) {
    return NextResponse.next()
  }

  // ── Proteção por papel ─────────────────────────────────────────
  // TUTOR tentando acessar área de aluno
  if (pathname.startsWith('/aluno') && papel === 'TUTOR') {
    return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
  }

  // ALUNO tentando acessar área de professor
  if (pathname.startsWith('/professor') && papel === 'ALUNO') {
    return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
