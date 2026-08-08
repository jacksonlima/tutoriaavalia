/**
 * Notas da Tutoria v2 — proxy.ts
 * Autor: Jackson Lima — CESUPA
 *
 * FIX: usa x-forwarded-host para construir URLs de redirect.
 * Sem isso, nextUrl.origin retorna tutoriaavalia.vercel.app
 * (host interno da Vercel) em vez de www.notasdatutoria.com.br,
 * criando um salto extra na cadeia de redirecionamentos.
 */
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Helper: constrói URL base usando o host real da requisição
// (x-forwarded-host sobrescreve o host interno da Vercel)
function baseUrl(req: any): string {
  const host  = req.headers.get('x-forwarded-host') ?? req.nextUrl.host
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export const proxy = auth((req) => {
  const { nextUrl } = req
  const { pathname } = nextUrl

  // FIND-011: Clear-Site-Data no logout
  if (pathname === '/api/auth/signout') {
    const res = NextResponse.next()
    res.headers.set('Clear-Site-Data', '"cookies", "storage", "cache"')
    return res
  }

  // Rotas públicas
  if (
    pathname.startsWith('/api/')   ||
    pathname.startsWith('/dev')    ||
    pathname.startsWith('/mobile') ||
    pathname.startsWith('/_next')  ||
    pathname === '/favicon.ico'    ||
    pathname === '/privacidade'    ||
    pathname === '/direitos'       ||
    pathname === '/conta/excluir'
  ) return NextResponse.next()

  const isLoggedIn    = !!req.auth
  const papel         = req.auth?.user?.papel         as string  | undefined
  const isCoordenador = req.auth?.user?.isCoordenador as boolean ?? false
  const isAdmin       = req.auth?.user?.isAdmin       as boolean ?? false
  const isLoginPage   = pathname === '/login'
  const base          = baseUrl(req)  // ← host real, não tutoriaavalia.vercel.app

  // Não logado
  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next()
    const url = new URL('/login', base)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Logado na tela de login → redireciona ao dashboard correto
  if (isLoginPage) {
    if (papel === 'ALUNO')       return NextResponse.redirect(new URL('/aluno/dashboard', base))
    if (papel === 'TUTOR') {
      if (isCoordenador)         return NextResponse.redirect(new URL('/professor/escolher-papel', base))
      return NextResponse.redirect(new URL('/professor/dashboard', base))
    }
    return NextResponse.next()
  }

  if (!papel) return NextResponse.next()

  // Proteção /professor/*
  if (pathname.startsWith('/professor')) {
    if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', base))
  }

  // Proteção /aluno/*
  if (pathname.startsWith('/aluno')) {
    if (papel === 'TUTOR') return NextResponse.redirect(new URL('/professor/dashboard', base))
  }

  // Proteção /coordenador/* — só TUTOR + isCoordenador
  if (pathname.startsWith('/coordenador')) {
    if (papel !== 'TUTOR' || !isCoordenador) {
      if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', base))
      return NextResponse.redirect(new URL('/professor/dashboard', base))
    }
  }

  // Proteção /admin/* — só TUTOR + isAdmin
  if (pathname.startsWith('/admin')) {
    if (papel !== 'TUTOR' || !isAdmin) {
      if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', base))
      return NextResponse.redirect(new URL('/professor/dashboard', base))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
