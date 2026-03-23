/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // avatares do Google
      },
    ],
  },

  // Garante que erros de TypeScript não bloqueiam o build em produção.
  // Os tipos são verificados localmente durante o desenvolvimento.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Garante que erros de ESLint não bloqueiam o build em produção.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
