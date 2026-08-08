/** @type {import('next').NextConfig} */

const securityHeaders = [
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com",
      "connect-src 'self' https://accounts.google.com https://*.neon.tech",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  { key: 'X-Frame-Options',                value: 'DENY' },
  // HSTS aplicado pelo Next.js — cobre tanto www quanto domínio raiz
  { key: 'Strict-Transport-Security',      value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Embedder-Policy',   value: 'unsafe-none' },
  { key: 'Cross-Origin-Opener-Policy',     value: 'same-origin-allow-popups' },
  { key: 'Cross-Origin-Resource-Policy',   value: 'same-origin' },
  { key: 'Permissions-Policy',             value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()' },
  { key: 'X-Content-Type-Options',         value: 'nosniff' },
  { key: 'Referrer-Policy',                value: 'strict-origin-when-cross-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const nextConfig = {
  poweredByHeader: false,

  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },

  typescript: { ignoreBuildErrors: true },

  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '*.ngrok.app',
  ],

  serverExternalPackages: ['@prisma/client', 'prisma'],

  // ── Redirect: domínio raiz → www (com HSTS aplicado pelo Next.js) ────────
  // Quando notasdatutoria.com.br é um "alias" na Vercel (não redirect),
  // o Next.js processa a requisição e aplica os headers ANTES do redirect.
  // Isso permite que o HSTS com includeSubDomains; preload seja enviado
  // no domínio raiz, tornando-o elegível para o HSTS preload list.
  async redirects() {
    return [
      {
        source:      '/:path*',
        has:         [{ type: 'host', value: 'notasdatutoria.com.br' }],
        destination: 'https://www.notasdatutoria.com.br/:path*',
        permanent:   true,
      },
    ]
  },

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
