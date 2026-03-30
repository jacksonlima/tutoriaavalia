/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },

  // TypeScript: ignora erros de tipo no build de produção
  typescript: {
    ignoreBuildErrors: true,
  },

  // Permite acesso cross-origin aos assets /_next/* em modo desenvolvimento.
  // Necessário para testes via ngrok, IP local (celular na mesma rede Wi-Fi), etc.
  // Em produção (next build) esta opção é ignorada.
  allowedDevOrigins: [
    '*.ngrok-free.app',   // ngrok domínio padrão
    '*.ngrok-free.dev',   // ngrok domínio alternativo (usado nesta sessão)
    '*.ngrok.io',         // ngrok domínio legado
    '*.ngrok.app',        // ngrok outros domínios
  ],

  // Prisma Client roda no Node.js runtime — não pode ser bundlado pelo Next.js
  // NOTA: No Next.js 14.x a chave correta é experimental.serverComponentsExternalPackages
  // (em Next.js 15+ passou a ser serverExternalPackages no nível raiz)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
}

module.exports = nextConfig

