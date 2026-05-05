/**
 * TutoriaAvalia v2 — Middleware de Segurança
 * Autor: Jackson Lima — CESUPA
 *
 * Responsabilidades:
 *   FIND-011: Adiciona Clear-Site-Data na resposta do signout para garantir
 *             limpeza de cookies, storage e cache do browser após logout
 *
 * Nota: os demais security headers (CSP, X-Frame-Options, etc.) são aplicados
 * via next.config.js headers() — não duplicar aqui para evitar conflitos.
 */

import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // FIND-011: Clear-Site-Data — limpa cookies/storage/cache no logout
  // Aplicado tanto no GET (página de confirmação) quanto no POST (ação de signout)
  if (pathname === '/api/auth/signout') {
    const res = NextResponse.next()
    res.headers.set('Clear-Site-Data', '"cookies", "storage", "cache"')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/auth/signout',
  ],
}
