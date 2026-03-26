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

  // Prisma Client roda no Node.js runtime — não pode ser bundlado pelo Next.js
  // NOTA: No Next.js 14.x a chave correta é experimental.serverComponentsExternalPackages
  // (em Next.js 15+ passou a ser serverExternalPackages no nível raiz)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
}

module.exports = nextConfig
