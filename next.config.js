/** @type {import('next').NextConfig} */

// ── Security Headers — corrige FIND-001 a FIND-010 do pentest ────────────────
// Aplicados em todas as rotas via source: '/(.*)'
const securityHeaders = [
  // FIND-001: Content-Security-Policy
  // Next.js usa scripts inline para hydration — 'unsafe-inline' necessário.
  // Em produção futura substituir por nonce-based CSP.
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com",
      "connect-src 'self' https://accounts.google.com https://*.neon.tech",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
    ].join('; '),
  },

  // FIND-002: X-Frame-Options — anti-clickjacking
  {
    key:   'X-Frame-Options',
    value: 'DENY',
  },

  // FIND-005: Cross-Origin isolation
  // COEP: unsafe-none e COOP: same-origin-allow-popups necessários para o popup do Google OAuth
  {
    key:   'Cross-Origin-Embedder-Policy',
    value: 'unsafe-none',
  },
  {
    key:   'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key:   'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },

  // FIND-006: Permissions-Policy — restringe APIs sensíveis do browser
  {
    key:   'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
  },

  // FIND-007: X-Content-Type-Options — evita MIME sniffing
  {
    key:   'X-Content-Type-Options',
    value: 'nosniff',
  },

  // FIND-008: Referrer-Policy — não vaza URLs internas
  {
    key:   'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },

  // FIND-010: X-Permitted-Cross-Domain-Policies — bloqueia clientes Adobe legados
  {
    key:   'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
]

const nextConfig = {
  // FIND-009: Remove header X-Powered-By que expõe stack Next.js
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname:  'lh3.googleusercontent.com',
      },
    ],
  },

  // TypeScript: ignora erros de tipo no build de produção
  typescript: {
    ignoreBuildErrors: true,
  },

  // Permite acesso cross-origin aos assets /_next/* em desenvolvimento
  // Necessário para testes via ngrok, IP local (celular na mesma rede)
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '*.ngrok.app',
  ],

  // Prisma Client roda no Node.js runtime — não pode ser bundlado pelo Next.js
  // Next.js 15+ e 16: chave no nível raiz (não mais em experimental)
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // ── Security Headers aplicados em todas as rotas ─────────────────────────
  async headers() {
    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
