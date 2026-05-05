import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TutoriaAvalia',
  description: 'Sistema de avaliação formativa para ABP — Aprendizagem Baseada em Problemas',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#1F4E79',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/*
          FIND-004: base tag com href absoluto evita Relative Path Confusion.
          Sem esta tag, URLs relativas em contextos de framing podem ser
          interpretadas de forma ambígua pelo browser em Quirks Mode.
          A correção principal é o X-Frame-Options: DENY (next.config.js),
          esta tag é uma camada de reforço adicional.
        */}
        <base href="https://tutoriaavalia.vercel.app/" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
