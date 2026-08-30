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

/** A church admin (SUPER_ADMIN + APPROVED) with valid credentials. */
export const createAdmin = async (options: { churchId: string }): Promise<{
    id: string;
    email: string;
    accessToken: string;
}> => {
    const user = await createUser();
    await addMembership({ userId: user.id, churchId: options.churchId, role: 'SUPER_ADMIN', status: 'APPROVED' });
    const { accessTokenFor } = await import('./auth.js');
    return { id: user.id, email: user.email, accessToken: await accessTokenFor(user.id, user.email) };
};