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
  serverExternalPackages: ['@prisma/client', 'prisma'],
}

module.exports = nextConfig
