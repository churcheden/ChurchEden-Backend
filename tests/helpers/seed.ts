import { randomUUID } from 'node:crypto';
import type { ChurchLanguage, CongregationSize } from '@prisma/client';
import { prisma } from '../../src/config/prisma.js';
import { hashPassword } from '../../src/utils/password.js';

export const createUser = async (options: {
    email?: string;
    isVerified?: boolean;
    passwordHash?: string;
} = {}): Promise<{ id: string; email: string }> => {
    const email = options.email ?? `seed-${randomUUID()}@test.com`;
    const member = await prisma.member.create({
        data: {
            email,
            password: options.passwordHash ?? (await hashPassword('Password123!')),
            isVerified: options.isVerified ?? true,
        },
    });
    return { id: member.id, email: member.email };
};

export const createChurch = async (options: {
    name?: string;
    churchId?: string;
} = {}): Promise<{ id: string; name: string }> => {
    const name = options.name ?? `Church ${randomUUID().slice(0, 8)}`;
    const adminEmail = `admin-${randomUUID()}@church.test`;
    const hashedPassword = await hashPassword('Password123!');
    const church = await prisma.church.create({
        data: {
            id: options.churchId ?? undefined,
            name,
            denomination: 'Test Denomination',
            congregationSize: 'RANGE_1_100' as CongregationSize,
            country: 'Ghana',
            city: 'Accra',
            address: '1 Test Street',
            phone: '+233241234567',
            email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@church.test`,
            primaryLanguage: 'ENGLISH' as ChurchLanguage,
            timeZone: 'Africa/Accra',
            superAdmin: {
                create: {
                    email: adminEmail,
                    password: hashedPassword,
                    fullName: 'Admin ' + name,
                    isVerified: true,
                },
            },
        },
    });
    return { id: church.id, name };
};

export const createAdmin = async (options: {
    churchId?: string;
} = {}): Promise<{
    id: string;
    email: string;
    accessToken: string;
}> => {
    const email = `admin-${randomUUID()}@test.com`;
    const hashedPassword = await hashPassword('Password123!');

    let churchId = options.churchId;
    let superAdmin;

    if (churchId) {
        superAdmin = await prisma.superAdmin.create({
            data: {
                email,
                password: hashedPassword,
                fullName: 'Test Admin',
                isVerified: true,
            },
        });
        await prisma.church.update({
            where: { id: churchId },
            data: { superAdminId: superAdmin.id },
        });
    } else {
        const church = await createChurch({ name: 'Admin Church' });
        const fetched = await prisma.church.findUnique({
            where: { id: church.id },
            select: { superAdminId: true },
        });
        superAdmin = await prisma.superAdmin.findUniqueOrThrow({
            where: { id: fetched!.superAdminId },
        });
    }

    const { adminAccessTokenFor } = await import('./auth.js');
    return {
        id: superAdmin.id,
        email: superAdmin.email,
        accessToken: await adminAccessTokenFor(superAdmin.id, superAdmin.email),
    };
};