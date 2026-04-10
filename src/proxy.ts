import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// A nova regra do Next 16: O nome da constante/função tem que ser 'proxy'
export const proxy = auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const isAuthRoute = nextUrl.pathname.startsWith('/login')
  const isMobileAuthRoute = nextUrl.pathname.startsWith('/mobile-')

  if (isMobileAuthRoute) {
    return NextResponse.next()
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/aluno/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    let from = nextUrl.pathname
    if (nextUrl.search) {
      from += nextUrl.search
    }
    return NextResponse.redirect(
      new URL(`/login?from=${encodeURIComponent(from)}`, nextUrl)
    )
  }

  return NextResponse.next()
})

// Aqui mantemos a configuração de quais rotas o proxy vai interceptar
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}