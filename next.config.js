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
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '*.ngrok.app',
  ],

  // Prisma Client roda no Node.js runtime — não pode ser bundlado pelo Next.js
  // No Next.js 14.x a chave correta é experimental.serverComponentsExternalPackages
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
}

module.exports = nextConfig
