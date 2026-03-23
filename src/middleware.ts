import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const { pathname } = nextUrl

  // ── Rotas que nunca são bloqueadas ──────────────────────────────
  if (
    pathname.startsWith('/api/auth') || // callbacks do NextAuth
    pathname.startsWith('/api/dev')  || // dev login (só em development)
    pathname.startsWith('/dev')      || // dev pages (só em development)
    pathname.startsWith('/_next')    || // assets do Next.js
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const isLoggedIn  = !!session?.user
  const papel       = session?.user?.papel  // 'TUTOR' | 'ALUNO' | null | undefined
  const isLoginPage = pathname === '/login'

  // ── Não logado ────────────────────────────────────────────────
  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next() // deixa a página de login renderizar
    const url = new URL('/login', nextUrl.origin)
    if (!pathname.startsWith('/login')) {
      url.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(url)
  }

  // ── Logado ────────────────────────────────────────────────────

  // Se está na página de login, redireciona para o dashboard correto
  if (isLoginPage) {
    if (papel === 'TUTOR')  return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
    if (papel === 'ALUNO')  return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
    // papel ainda não carregou (banco lento): deixa o login renderizar
    // o jwt callback vai popular na próxima requisição
    return NextResponse.next()
  }

  // Se o papel ainda não está no token (ex: banco lento no login inicial)
  // permite a requisição passar — o jwt callback vai resolver
  if (!papel) {
    return NextResponse.next()
  }

  // ── Proteção por papel ────────────────────────────────────────
  const isProfRoute = pathname.startsWith('/professor')
  const isAlunoRoute = pathname.startsWith('/aluno')

  if (isProfRoute && papel !== 'TUTOR') {
    return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
  }

  if (isAlunoRoute && papel !== 'ALUNO') {
    return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
