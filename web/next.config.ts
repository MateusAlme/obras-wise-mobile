import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hiuagpzaelcocyxutgdt.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/obra-photos/**',
      },
      {
        protocol: 'https',
        hostname: 'hiuagpzaelcocyxutgdt.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/avatars/**',
      },
    ],
  },
}

export default nextConfig
