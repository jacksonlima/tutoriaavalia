/**
 * TutoriaAvalia v2
 * Autor: Jackson Lima — CESUPA
 * Sistema de avaliação formativa para Aprendizagem Baseada em Problemas (ABP)
 *
 * proxy.ts — Proteção de rotas no Next.js 16.
 * ATENÇÃO: No Next.js 16 o arquivo DEVE se chamar proxy.ts e exportar 'proxy'.
 *          O antigo middleware.ts foi descontinuado nesta versão.
 *
 * Segurança implementada:
 *   1. Rotas públicas liberadas (api, dev, mobile, _next, favicon)
 *   2. Não logado → redireciona para /login
 *   3. Logado na página de login → redireciona para o dashboard correto
 *   4. Proteção por papel: ALUNO não acessa /professor e vice-versa
 */
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const proxy = auth((req) => {
  const { nextUrl } = req
  const { pathname } = nextUrl

  // ── Rotas públicas — nunca bloqueadas ───────────────────────────
  if (
    pathname.startsWith('/api/')       ||
    pathname.startsWith('/dev')          ||
    pathname.startsWith('/mobile')       ||
    pathname.startsWith('/_next')        ||
    pathname === '/favicon.ico'          ||
    pathname === '/privacidade'          ||   // Política de Privacidade — pública
    pathname === '/direitos'             ||   // Canal de direitos LGPD — público
    pathname === '/conta/excluir'            // Exclusão de conta — auth verificada internamente
  ) {
    return NextResponse.next()
  }

  const isLoggedIn  = !!req.auth
  const papel       = req.auth?.user?.papel as string | undefined
  const isLoginPage = pathname === '/login'

  // ── Não logado → vai para o login ──────────────────────────────
  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next()
    const url = new URL('/login', nextUrl.origin)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // ── Logado na página de login → redireciona ao dashboard ───────
  if (isLoginPage) {
    if (papel === 'TUTOR') return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
    if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
    return NextResponse.next()
  }

  // ── Sem papel ainda (banco carregando) → deixa passar ──────────
  if (!papel) return NextResponse.next()

  // ── Proteção por papel ─────────────────────────────────────────
  if (pathname.startsWith('/aluno') && papel === 'TUTOR') {
    return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
  }
  if (pathname.startsWith('/professor') && papel === 'ALUNO') {
    return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
