import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { googleStrategy } from '../src/config/passport.js';
import { resetFakes } from './helpers/fakes.js';
import { resetDatabase } from './helpers/db.js';

type VerifyResult = { err: Error | null; user: any };

const runVerify = (profile: { id: string; emails?: { value: string }[]; displayName?: string | null }): Promise<VerifyResult> =>
    new Promise((resolve, reject) => {
        try {
            googleStrategy._verify.call(
                googleStrategy,
                {},
                'access-token',
                'refresh-token',
                {
                    provider: 'google',
                    ...profile,
                },
                (err: Error | null, user?: unknown) => resolve({ err, user }),
            );
        } catch (error) {
            reject(error as Error);
        }
    });

const profileFor = (email: string, overrides: Record<string, unknown> = {}) => ({
    id: `google-${randomUUID()}`,
    emails: [{ value: email, verified: true }],
    displayName: 'Jane Doe',
    ...overrides,
});

describe('googleStrategy._verify', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    it('creates a new verified GOOGLE user with a random hashed password', async () => {
        const email = `${randomUUID()}@gmail.com`;
        const result = await runVerify(profileFor(email));

        expect(result.err).toBeNull();
        const user = await prisma.user.findUnique({ where: { id: result.user.id } });
        expect(user).not.toBeNull();
        expect(user!.email).toBe(email);
        expect(user!.googleId).toBeTruthy();
        expect(user!.loginProvider).toBe('GOOGLE');
        expect(user!.isVerified).toBe(true);
        expect(user!.fullName).toBe('Jane Doe');

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
        expect(stored.password!.startsWith('$2')).toBe(true);
    });

    it('returns the existing user when the googleId is already linked', async () => {
        const seeded = await prisma.user.create({
            data: {
                email: `${randomUUID()}@gmail.com`,
                googleId: 'google-pre-existing',
                fullName: 'Linked User',
                loginProvider: 'GOOGLE',
                isVerified: true,
                password: 'irrelevant',
            },
        });

        const result = await runVerify(profileFor(`${randomUUID()}@gmail.com`, { id: 'google-pre-existing' }));
        expect(result.err).toBeNull();
        expect(result.user.id).toBe(seeded.id);

        const after = await prisma.user.findUniqueOrThrow({ where: { id: seeded.id } });
        expect(after.fullName).toBe('Linked User');
        expect(after.loginProvider).toBe('GOOGLE');
    });

    it('links an existing email-only user to Google and verifies them', async () => {
        const email = `${randomUUID()}@gmail.com`;
        const seeded = await prisma.user.create({
            data: {
                email,
                password: 'some-hash',
                fullName: 'Email User',
                loginProvider: 'EMAIL',
                isVerified: false,
            },
        });

        const result = await runVerify(profileFor(email));
        expect(result.err).toBeNull();
        expect(result.user.id).toBe(seeded.id);

        const after = await prisma.user.findUniqueOrThrow({ where: { id: seeded.id } });
        expect(after.googleId).toBeTruthy();
        expect(after.loginProvider).toBe('GOOGLE');
        expect(after.isVerified).toBe(true);
    });

    it('fails with an error when the Google profile has no email', async () => {
        const result = await runVerify({ id: `google-${randomUUID()}`, email: undefined as any, emails: undefined });
        expect(result.err?.message).toBe('No email found in Google profile!');
        expect(result.user).toBeUndefined();
    });

    it('fails with an error when the Google profile has an empty emails array', async () => {
        const result = await runVerify({ id: `google-${randomUUID()}`, emails: [] });
        expect(result.err?.message).toBe('No email found in Google profile!');
        expect(result.user).toBeUndefined();
    });
});