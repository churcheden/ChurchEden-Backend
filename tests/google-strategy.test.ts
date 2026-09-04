import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { googleStrategy } from '../src/config/passport.js';
import { resetFakes } from './helpers/fakes.js';
import { resetDatabase } from './helpers/db.js';

type VerifyResult = { err: Error | null; user: any };

const runVerify = (
    profile: { id: string; emails?: { value: string }[]; displayName?: string | null },
    state: string = 'mobile'
): Promise<VerifyResult> =>
    new Promise((resolve, reject) => {
        try {
            googleStrategy._verify.call(
                googleStrategy,
                { query: { state } } as any,
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

describe('googleStrategy._verify (mobile path)', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    it('creates a new verified Member for mobile Google login', async () => {
        const email = `${randomUUID()}@gmail.com`;
        const result = await runVerify(profileFor(email), 'mobile');

        expect(result.err).toBeNull();
        const member = await prisma.member.findUnique({ where: { id: result.user.id } });
        expect(member).not.toBeNull();
        expect(member!.email).toBe(email);
        expect(member!.googleId).toBeTruthy();
        expect(member!.isVerified).toBe(true);
    });

    it('returns the existing Member when the googleId is already linked', async () => {
        const seeded = await prisma.member.create({
            data: {
                email: `${randomUUID()}@gmail.com`,
                googleId: 'google-pre-existing',
                isVerified: true,
            },
        });

        const result = await runVerify(profileFor(`${randomUUID()}@gmail.com`, { id: 'google-pre-existing' }), 'mobile');
        expect(result.err).toBeNull();
        expect(result.user.id).toBe(seeded.id);

        const after = await prisma.member.findUniqueOrThrow({ where: { id: seeded.id } });
        expect(after.googleId).toBe('google-pre-existing');
    });

    it('links an existing email-only Member to Google and verifies them', async () => {
        const email = `${randomUUID()}@gmail.com`;
        const seeded = await prisma.member.create({
            data: {
                email,
                password: 'some-hash',
                isVerified: false,
            },
        });

        const result = await runVerify(profileFor(email), 'mobile');
        expect(result.err).toBeNull();
        expect(result.user.id).toBe(seeded.id);

        const after = await prisma.member.findUniqueOrThrow({ where: { id: seeded.id } });
        expect(after.googleId).toBeTruthy();
        expect(after.isVerified).toBe(true);
    });

    it('fails with an error when the Google profile has no email', async () => {
        const result = await runVerify({ id: `google-${randomUUID()}`, email: undefined as any, emails: undefined }, 'mobile');
        expect(result.err?.message).toBe('No email found in Google profile!');
        expect(result.user).toBeUndefined();
    });

    it('fails with an error when the Google profile has an empty emails array', async () => {
        const result = await runVerify({ id: `google-${randomUUID()}`, emails: [] }, 'mobile');
        expect(result.err?.message).toBe('No email found in Google profile!');
        expect(result.user).toBeUndefined();
    });
});