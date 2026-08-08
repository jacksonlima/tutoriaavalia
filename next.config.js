/** @type {import('next').NextConfig} */

// ── Security Headers ─────────────────────────────────────────────────────────
const securityHeaders = [
  // ── Content-Security-Policy ──────────────────────────────────────────────
  // Notas sobre unsafe-inline e unsafe-eval:
  // - 'unsafe-inline' em script-src: necessário para o Next.js 16 (hidratação)
  //   A solução definitiva é nonce-based CSP (refatoração futura)
  // - 'unsafe-eval' em script-src: removido — testado sem quebrar o app
  // - 'unsafe-inline' em style-src: necessário para Tailwind CSS
  //   A solução definitiva é CSS-in-JS sem inline styles (refatoração futura)
  // - frame-ancestors: adicionado (complementa X-Frame-Options, CSP3)
  {
    key:   'Content-Security-Policy',
    value: [
      // default-src restritivo — bloqueia tudo não explicitamente permitido
      "default-src 'self'",
      // Scripts: self + inline (Next.js hidratação) — SEM unsafe-eval
      "script-src 'self' 'unsafe-inline' https://accounts.google.com",
      // Estilos: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fontes
      "font-src 'self' https://fonts.gstatic.com",
      // Imagens: self + data URIs + Google avatars
      "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com",
      // Conexões: self + Google OAuth + Neon
      "connect-src 'self' https://accounts.google.com https://*.neon.tech",
      // Frames: só Google OAuth popup
      "frame-src https://accounts.google.com",
      // Bloqueia plugins (Flash, Java, etc.)
      "object-src 'none'",
      // Restringe tag <base>
      "base-uri 'self'",
      // Restringe onde formulários podem ser enviados
      "form-action 'self' https://accounts.google.com",
      // CSP3: frame-ancestors — controle fino sobre quem pode enquadrar o site
      // Mais específico que X-Frame-Options (que mantemos como fallback)
      "frame-ancestors 'none'",
      // Bloqueia upgrade de requests HTTP para HTTPS
      "upgrade-insecure-requests",
    ].join('; '),
  },

  // ── X-Frame-Options (fallback para browsers sem suporte a frame-ancestors) ─
  {
    key:   'X-Frame-Options',
    value: 'DENY',
  },

  // ── HSTS — aumentado para 1 ano + preload + includeSubDomains ─────────────
  // Antes: max-age=15768000 (6 meses), sem preload
  // Agora: max-age=31536000 (1 ano) + preload + includeSubDomains
  // Para submeter ao preload list: https://hstspreload.org/
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },

  // ── Cross-Origin isolation ────────────────────────────────────────────────
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

  // ── Outros headers ────────────────────────────────────────────────────────
  {
    key:   'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
  },
  {
    key:   'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key:   'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key:   'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
]

const nextConfig = {
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname:  'lh3.googleusercontent.com',
      },
    ],
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '*.ngrok.app',
  ],

  serverExternalPackages: ['@prisma/client', 'prisma'],

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
