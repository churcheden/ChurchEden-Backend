import { randomUUID } from 'node:crypto';
import type { ChurchLanguage, CongregationSize, MembershipStatus } from '@prisma/client';
import { prisma } from '../../src/config/prisma.js';

export const createUser = async (options: {
    email?: string;
    isVerified?: boolean;
    loginProvider?: 'EMAIL' | 'GOOGLE';
    passwordHash?: string;
} = {}): Promise<{ id: string; email: string }> => {
    const email = options.email ?? `seed-${randomUUID()}@test.com`;
    const user = await prisma.user.create({
        data: {
            email,
            password: options.passwordHash ?? `hash-${randomUUID()}`,
            isVerified: options.isVerified ?? true,
            loginProvider: options.loginProvider ?? 'EMAIL',
        },
    });
    return { id: user.id, email: user.email };
};

export const createChurch = async (options: {
    name?: string;
    churchId?: string;
} = {}): Promise<{ id: string; name: string }> => {
    const name = options.name ?? `Church ${randomUUID().slice(0, 8)}`;
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
        },
    });
    return { id: church.id, name };
};

export const addMembership = async (options: {
    userId: string;
    churchId: string;
    role?: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';
    status?: MembershipStatus;
}): Promise<{ id: string }> => {
    const membership = await prisma.churchMembership.create({
        data: {
            userId: options.userId,
            churchId: options.churchId,
            role: options.role ?? 'MEMBER',
            status: options.status ?? 'PENDING',
        },
    });
    return { id: membership.id };
};

/**
 * A church admin (an Admin-table row linked to a User) with valid ADMIN
 * credentials. One admin identity = one church (Admin.email and
 * Admin.linkedUserId are both unique), so a church is passed per call.
 */
export const createAdmin = async (options: {
    churchId: string;
    role?: 'ADMIN' | 'SUPER_ADMIN';
}): Promise<{
    id: string;
    email: string;
    accessToken: string;
}> => {
    const user = await createUser();
    const admin = await prisma.admin.create({
        data: {
            email: user.email,
            fullName: null,
            churchId: options.churchId,
            role: options.role ?? 'SUPER_ADMIN',
            isActive: true,
            isVerified: true,
            loginProvider: 'EMAIL',
            linkedUserId: user.id,
        },
    });
    const { adminAccessTokenFor } = await import('./auth.js');
    return {
        id: admin.id,
        email: admin.email,
        accessToken: await adminAccessTokenFor(admin.id, admin.email),
    };
};