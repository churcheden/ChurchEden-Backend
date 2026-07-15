import ws from 'ws';
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

neonConfig.webSocketConstructor = ws;

declare global {
    var prisma: PrismaClient | undefined
};

const connectionString = `${env.DATABASE_URL}`;

const adapter = new PrismaNeon({ connectionString });
const prisma = global.prisma || new PrismaClient({adapter});

if(env.APP_STAGE === 'dev') {
    global.prisma = prisma
};

export { prisma };