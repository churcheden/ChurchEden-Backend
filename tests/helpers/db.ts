import { prisma } from '../../src/config/prisma.js';

/**
 * Truncates every table used by the API. Children are deleted before parents to
 * be explicit about FK ordering (rather than relying on ON DELETE CASCADE).
 */
export const resetDatabase = async (): Promise<void> => {
    await prisma.superAdminRefreshToken.deleteMany();
    await prisma.memberRefreshToken.deleteMany();
    await prisma.memberProfile.deleteMany();
    await prisma.churchRequest.deleteMany();
    await prisma.member.deleteMany();
    await prisma.serviceTime.deleteMany();
    await prisma.churchMinistry.deleteMany();
    await prisma.churchTransaction.deleteMany();
    await prisma.church.deleteMany();
    await prisma.superAdmin.deleteMany();
};