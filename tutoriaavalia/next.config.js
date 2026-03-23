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
  // PWA será adicionado na Fase 6
}

module.exports = nextConfig
