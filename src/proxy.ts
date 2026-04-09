import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const { pathname } = nextUrl

  if (
    pathname.startsWith('/api/')        ||
    pathname.startsWith('/dev')         ||
    pathname.startsWith('/_next')       ||
    pathname === '/favicon.ico'         ||
    pathname === '/mobile-signin'
  ) {
    return NextResponse.next()
  }

  const token = await getToken({
    req,
    secret:     process.env.NEXTAUTH_SECRET,
    cookieName: 'authjs.session-token',
  })

  const isLoggedIn  = !!token
  const papel       = token?.papel as string | undefined
  const isLoginPage = pathname === '/login'

  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next()
    const url = new URL('/login', nextUrl.origin)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  if (isLoginPage) {
    if (papel === 'TUTOR') return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
    if (papel === 'ALUNO') return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))
    return NextResponse.next()
  }

  if (!papel) return NextResponse.next()

  if (pathname.startsWith('/aluno')     && papel === 'TUTOR')
    return NextResponse.redirect(new URL('/professor/dashboard', nextUrl.origin))
  if (pathname.startsWith('/professor') && papel === 'ALUNO')
    return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl.origin))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
