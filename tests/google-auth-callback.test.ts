import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/env.js';
import { emailServiceMock, resetFakes } from './helpers/fakes.js';
import { resetDatabase } from './helpers/db.js';

vi.mock('../src/config/passport.js', () => {
    let fakeUser: unknown = null;
    return {
        googleStrategy: {},
        passport: {
            initialize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
            use: () => {},
            authenticate: () => (req: { user?: unknown }, _res: unknown, next: () => void) => {
                req.user = fakeUser;
                next();
            },
            __setUser: (user: unknown) => {
                fakeUser = user;
            },
        },
    };
});

import { passport as mockedPassport } from '../src/config/passport.js';

const setGoogleUser = (user: unknown): void =>
    (mockedPassport as unknown as { __setUser: (u: unknown) => void }).__setUser(user);

describe('GET /api/v1/auth/google/callback (googleCallback, passport injects req.user)', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
        setGoogleUser(null);
    });

    it('redirects to the app callback, issues cookies, sends a welcome email and reports profile incomplete for a new user', async () => {
        const created = await prisma.user.create({
            data: {
                email: `${randomUUID()}@gmail.com`,
                googleId: `google-${randomUUID()}`,
                fullName: 'Jane Doe',
                loginProvider: 'GOOGLE',
                isVerified: true,
                password: 'irrelevant',
            },
        });
        setGoogleUser({ id: created.id, email: created.email });

        const res = await request(app).get('/api/v1/auth/google/callback');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${env.FRONTEND_URL}/auth/callback?profileComplete=false`);

        const cookies = (res.headers['set-cookie'] ?? []) as string[];
        expect(cookies.some((c) => c.startsWith('token='))).toBe(true);
        expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
        expect(cookies.some((c) => /HttpOnly/i.test(c))).toBe(true);

        expect(emailServiceMock.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(emailServiceMock.sendWelcomeEmail.mock.calls[0][0]).toMatchObject({
            firstName: 'Jane',
            fullName: 'Jane Doe',
            email: created.email,
            signInUrl: `${env.FRONTEND_URL}/onboarding/sign-in`,
        });
    });

    it('reports profile complete when the user already has a member profile and skips the welcome email for an old account', async () => {
        const created = await prisma.user.create({
            data: {
                email: `${randomUUID()}@gmail.com`,
                googleId: `google-${randomUUID()}`,
                fullName: 'Old User',
                loginProvider: 'GOOGLE',
                isVerified: true,
                password: 'irrelevant',
                createdAt: new Date(Date.now() - 30 * 60 * 1000),
            },
        });
        await prisma.memberProfile.create({
            data: {
                userId: created.id,
                fullName: 'Old User',
                dateOfBirth: new Date('1990-01-01'),
                gender: 'FEMALE',
                phoneNumber: `+234802${randomUUID().slice(0, 8)}`,
                contactEmail: created.email,
                city: 'Lagos',
                address: '1 Test Street',
                maritalStatus: 'SINGLE',
            },
        });
        setGoogleUser({ id: created.id, email: created.email });

        const res = await request(app).get('/api/v1/auth/google/callback');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${env.FRONTEND_URL}/auth/callback?profileComplete=true`);
        expect(emailServiceMock.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('redirects to the failure URL when no user is in the request', async () => {
        const res = await request(app).get('/api/v1/auth/google/callback');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(`${env.FRONTEND_URL}/sign-in?error=auth_failed`);
        expect(emailServiceMock.sendWelcomeEmail).not.toHaveBeenCalled();
    });
});