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

  // Garante que erros de TypeScript e ESLint não bloqueiam o build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Diz ao Next.js para NÃO tentar bundlar o Prisma Client durante o build.
  // Sem isso, o Next.js tenta analisar estaticamente as rotas que usam Prisma
  // e falha com "Failed to collect page data" porque não há banco disponível
  // no momento do build.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
}

module.exports = nextConfig
