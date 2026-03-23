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

  // Ignora erros de TypeScript e ESLint no build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Prisma e NextAuth precisam rodar no Node.js runtime, não no Edge runtime
  // Isso impede o Next.js de tentar bundlar o @prisma/client durante o build
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma', 'bcryptjs'],
  },
}

module.exports = nextConfig
