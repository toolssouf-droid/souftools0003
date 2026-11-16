import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'archive.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: [
    '@libsql/client',
    'better-auth',
    'bcryptjs',
    '@whiskeysockets/baileys',
    'pino',
    'ws',
    'nodemailer',
    'web-push',
    'qrcode',
  ],
  experimental: {
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
    cpus: 1,
    workerThreads: false,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    serverSourceMaps: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 200,
    optimizePackageImports: ['lucide-react', 'motion'],
  },
};

export default nextConfig;

