/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma のネイティブエンジンをサーバーバンドルから外す
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
