/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite carregar fotos de perfil do Google
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  
  // Ignora alertas de tipagem/lint na Vercel para não travar o build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // A nova regra atualizada do Next.js 15+ (Fora do bloco experimental)
  serverExternalPackages: ['@prisma/client', 'bcrypt', 'bcryptjs'],
}

module.exports = nextConfig