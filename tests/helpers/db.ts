import { prisma } from '../../src/config/prisma.js';

/**
 * Truncates every table used by the API. Children are deleted before parents to
 * be explicit about FK ordering (rather than relying on ON DELETE CASCADE).
 */
export const resetDatabase = async (): Promise<void> => {
    await prisma.adminRefreshToken.deleteMany();
    await prisma.admin.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.churchMembership.deleteMany();
    await prisma.serviceTime.deleteMany();
    await prisma.churchMinistry.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.memberProfile.deleteMany();
    await prisma.church.deleteMany();
    await prisma.user.deleteMany();
};