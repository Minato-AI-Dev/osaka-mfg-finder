import { PrismaClient } from '@prisma/client';

// 開発時のホットリロードで接続が増えないようにシングルトンにする
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
