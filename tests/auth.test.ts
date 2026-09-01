import { randomUUID } from 'node:crypto';
import { createSecretKey } from 'node:crypto';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/env.js';
import { hashPassword } from '../src/utils/password.js';
import { CacheService, cacheKeys } from '../src/utils/cache.js';
import { emailServiceMock, fakeRedis, resetFakes } from './helpers/fakes.js';
import {
    authHeader,
    extractLastOtp,
    extractLastResetToken,
    register,
    registerAndVerify,
} from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const cookieValue = (setCookies: string[] | undefined, name: string): string => {
    const row = (setCookies ?? []).find((cookie) => cookie.startsWith(`${name}=`));
    const pair = row?.split(';')[0];
    return pair?.split('=').slice(1).join('=') ?? '';
};

const setCookieHeader = (cookieName: string, value: string): { Cookie: string } => ({
    Cookie: `${cookieName}=${value}`,
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const expiredRefreshTokenFor = async (user: { id: string; email: string }): Promise<string> => {
    const secretKey = createSecretKey(env.REFRESH_TOKEN_SECRET, 'utf-8');
    return new SignJWT({ id: user.id, email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Date.now() / 1000 - 7200)
        .setExpirationTime(Date.now() / 1000 - 3600)
        .sign(secretKey);
};

describe('auth', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    afterEach(() => {
        emailServiceMock.sendVerificationOTPEmail.mockReset();
        emailServiceMock.sendVerificationOTPEmail.mockResolvedValue(true);
        emailServiceMock.sendWelcomeEmail.mockReset();
        emailServiceMock.sendWelcomeEmail.mockResolvedValue(true);
    });

    describe('POST /api/v1/auth/register', () => {
        it('201 — stores only a pending Redis draft, no user row, and emails the OTP', async () => {
            const email = `${randomUUID()}@test.com`;
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ email, password: 'StrongPass123!' });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.requiresVerification).toBe(true);

            const user = await prisma.user.findUnique({ where: { email } });
            expect(user).toBeNull();

            const otp = extractLastOtp(email);
            expect(otp).toMatch(/^\d{6}$/);

            const draft = await CacheService.get(cacheKeys.pendingRegistration(email));
            expect(draft).not.toBeNull();
            expect(fakeRedis.has(cacheKeys.pendingRegistration(email))).toBe(true);
        });

        it('400 — unknown shape rejected by validation', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ email: 'not-an-email', password: 'short' });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
            expect(res.body.code).toBe('VALIDATION_FAILED');
            expect(res.body.details.length).toBeGreaterThan(0);
        });

        it('400 — USER_EXISTS when the email is already a verified user', async () => {
            const { email, password } = await registerAndVerify();
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ email, password });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('USER_EXISTS');
        });

        it('503 — EMAIL_SEND_FAILED when the email provider call fails', async () => {
            emailServiceMock.sendVerificationOTPEmail.mockResolvedValueOnce(false);
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ email: `${randomUUID()}@test.com`, password: 'StrongPass123!' });
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('EMAIL_SEND_FAILED');
        });
    });

    describe('POST /api/v1/auth/verify-email', () => {
        it('returns 400 when OTP is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/verify-email')
                .send({ email: `${randomUUID()}@test.com` });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('400 — PENDING_REGISTRATION_NOT_FOUND when the draft expired (simulated by clearing redis)', async () => {
            const { email } = await register();
            fakeRedis.clear();
            const res = await request(app)
                .post('/api/v1/auth/verify-email')
                .send({ email, otp: '123456' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PENDING_REGISTRATION_NOT_FOUND');
        });

        it('200 — creates the user, issues tokens, sets cookies and sends the welcome email', async () => {
            const { email } = await register();
            const otp = extractLastOtp(email);

            const res = await request(app)
                .post('/api/v1/auth/verify-email')
                .send({ email, otp });

            expect(res.status).toBe(200);
            expect(res.body.accessToken).toBeTruthy();
            expect(res.body.refreshToken).toBeTruthy();
            expect(res.body.user.email).toBe(email);
            expect(res.body.user.isVerified).toBe(true);

            const user = await prisma.user.findUnique({ where: { email } });
            expect(user?.isVerified).toBe(true);

            const setCookies = res.headers['set-cookie'] as unknown as string[];
            expect(cookieValue(setCookies, 'token')).toBeTruthy();
            expect(cookieValue(setCookies, 'refreshToken')).toBeTruthy();
            expect(setCookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);

            expect(emailServiceMock.sendWelcomeEmail).toHaveBeenCalledWith(
                expect.objectContaining({ email }),
            );

            expect(fakeRedis.has(cacheKeys.pendingRegistration(email))).toBe(false);
        });

        it('deletes the draft after 5 wrong attempts and blocks further verification', async () => {
            const { email } = await register();
            const otp = extractLastOtp(email);

            for (let attempt = 0; attempt < 4; attempt += 1) {
                const res = await request(app)
                    .post('/api/v1/auth/verify-email')
                    .send({ email, otp: '000000' });
                expect(res.status).toBe(400);
                expect(res.body.code).toBe('INVALID_OTP');
            }

            const fifth = await request(app)
                .post('/api/v1/auth/verify-email')
                .send({ email, otp: '000000' });
            expect(fifth.status).toBe(400);
            expect(fifth.body.code).toBe('TOO_MANY_ATTEMPTS');

            expect(await CacheService.get(cacheKeys.pendingRegistration(email))).toBeNull();

            // The 6th request is blocked by the auth limiter (5 failed attempts/hr).
            const after = await request(app)
                .post('/api/v1/auth/verify-email')
                .send({ email, otp });
            expect(after.status).toBe(429);
        });
    });

    describe('POST /api/v1/auth/resend-verification', () => {
        it('200 — rotates the OTP for an existing pending registration', async () => {
            const { email } = await register();
            const firstOtp = extractLastOtp(email);

            const res = await request(app)
                .post('/api/v1/auth/resend-verification')
                .send({ email });
            expect(res.status).toBe(200);

            const secondOtp = extractLastOtp(email);
            expect(secondOtp).toMatch(/^\d{6}$/);
            expect(secondOtp).not.toBe(firstOtp);
        });

        it('400 — PENDING_REGISTRATION_NOT_FOUND', async () => {
            const res = await request(app)
                .post('/api/v1/auth/resend-verification')
                .send({ email: `${randomUUID()}@test.com` });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PENDING_REGISTRATION_NOT_FOUND');
        });

        it('429 — resend limiter allows at most 3 per 10 minutes keyed by email', async () => {
            const { email } = await register();
            for (let i = 0; i < 3; i += 1) {
                const res = await request(app)
                    .post('/api/v1/auth/resend-verification')
                    .send({ email });
                expect(res.status).toBe(200);
            }
            const fourth = await request(app)
                .post('/api/v1/auth/resend-verification')
                .send({ email });
            expect(fourth.status).toBe(429);
            expect(fourth.body.status).toBe('error');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('200 — signs the user in and issues tokens + cookies', async () => {
            const { email, password } = await registerAndVerify();
            const res = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email, password });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.accessToken).toBeTruthy();
            expect(res.body.refreshToken).toBeTruthy();
            expect(res.body.user.email).toBe(email);
        });

        it('401 — identical response body for wrong password and unknown email (anti-enumeration)', async () => {
            const { email, password } = await registerAndVerify();

            const wrongPassword = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email, password: 'WrongPassword1!' });
            const unknownEmail = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email: `${randomUUID()}@test.com`, password: 'Whatever123!' });

            expect(wrongPassword.status).toBe(401);
            expect(wrongPassword.body).toMatchObject({
                status: 'error',
                code: 'UNAUTHORIZED',
                message: 'Invalid email or password!',
            });
            expect(unknownEmail.status).toBe(401);
            expect(unknownEmail.body).toEqual(wrongPassword.body);
            expect(unknownEmail.body.message).toBe('Invalid email or password!');
        });

        it('403 — EMAIL_NOT_VERIFIED for unverified email-provider accounts', async () => {
            const email = `${randomUUID()}@test.com`;
            const password = 'StrongPass123!';
            await prisma.user.create({
                data: { email, password: await hashPassword(password), isVerified: false },
            });

            const res = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email, password });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
        });

        it('401 — Google strategy accounts cannot sign in with a guessed password', async () => {
            const email = `${randomUUID()}@test.com`;
            await prisma.user.create({
                data: {
                    email,
                    password: await hashPassword(`secrets-${randomUUID()}`),
                    loginProvider: 'GOOGLE',
                    googleId: `google-${randomUUID()}`,
                    isVerified: true,
                },
            });

            const res = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email, password: 'StrongPass123!' });
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('UNAUTHORIZED');
            expect(res.body.message).toBe('Invalid email or password!');
        });
    });

    describe('POST /api/v1/auth/refresh (dual delivery + rotation)', () => {
        it('200 — mobile path: refreshes using the token in the request body', async () => {
            const { refreshToken } = await registerAndVerify();

            const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
            expect(res.status).toBe(200);
            expect(res.body.data.newAccessToken).toBeTruthy();
            expect(res.body.data.newRefreshToken).toBeTruthy();
        });

        it('200 — web path: refreshes using the httpOnly cookie (ignores the body)', async () => {
            const user = await registerAndVerify();

            // Guarantee the later login token differs from the earlier body token.
            await sleep(1100);

            // Revoke every refresh token for the user, then log in fresh. The only
            // still-active token is the one held in the browser cookie.
            await prisma.refreshToken.updateMany({
                where: { userId: user.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            const loginRes = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email: user.email, password: user.password });
            const cookie = cookieValue(
                loginRes.headers['set-cookie'] as unknown as string[],
                'refreshToken',
            );
            expect(cookie).toBeTruthy();

            const res = await request(app)
                .post('/api/v1/auth/refresh')
                .set('x-client-platform', 'web')
                .set(setCookieHeader('refreshToken', cookie))
                .send({ refreshToken: user.refreshToken });
            expect(res.status).toBe(200);
            expect(res.body.data.newAccessToken).toBeTruthy();
        });

        it('401 — web clients must supply the cookie, the body token is ignored', async () => {
            const { refreshToken } = await registerAndVerify();
            const res = await request(app)
                .post('/api/v1/auth/refresh')
                .set('x-client-platform', 'web')
                .send({ refreshToken });
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('MISSING_TOKEN');
        });

        it('401 — MISSING_TOKEN when absent', async () => {
            const res = await request(app).post('/api/v1/auth/refresh').send({});
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('MISSING_TOKEN');
        });

        it('rotates: the used refresh token is revoked and cannot be reused', async () => {
            const { refreshToken } = await registerAndVerify();

            // Refresh tokens are JWTs whose iat has whole-second resolution, so two
            // tokens issued in the same second are byte-identical. Wait before
            // rotating so the rotated token is provably different from the old one.
            await sleep(1100);

            const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
            expect(res.status).toBe(200);
            const rotated = res.body.data.newRefreshToken as string;
            expect(rotated).toBeTruthy();
            expect(rotated).not.toBe(refreshToken);

            const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
            expect(replay.status).toBe(401);
            expect(replay.body.code).toBe('INVALID_TOKEN');

            const newTokenWorks = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: rotated });
            expect(newTokenWorks.status).toBe(200);
        });

        it('401 — INVALID_TOKEN for an expired refresh token (never a 500)', async () => {
            const user = await registerAndVerify();
            const expired = await expiredRefreshTokenFor({ id: user.userId, email: user.email });

            const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: expired });
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('INVALID_TOKEN');
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        it('200 — revokes the users refresh tokens so the old token can no longer refresh', async () => {
            const { accessToken, refreshToken } = await registerAndVerify();

            const logout = await request(app)
                .post('/api/v1/auth/logout')
                .set(authHeader(accessToken));
            expect(logout.status).toBe(200);

            const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
            expect(replay.status).toBe(401);

            expect(fakeRedis.has(cacheKeys.userMe((await prisma.user.findFirstOrThrow()).id))).toBe(false);
        });

        it('200 — logging out via the refresh token in the body (mobile) also revokes the session', async () => {
            const { refreshToken } = await registerAndVerify();
            const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
            expect(logout.status).toBe(200);

            const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
            expect(replay.status).toBe(401);
        });

        it('200 — idempotent even without a token', async () => {
            const res = await request(app).post('/api/v1/auth/logout');
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        it('200 — silent response regardless of whether the email exists', async () => {
            const existing = `${randomUUID()}@test.com`;
            await registerAndVerify({ email: existing });

            const known = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email: existing });
            const unknown = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email: `${randomUUID()}@test.com` });

            expect(known.status).toBe(200);
            expect(unknown.status).toBe(200);
            expect(known.body).toEqual(unknown.body);
        });

        it('200 — stores a hashed reset token and emails the raw one', async () => {
            const { email } = await registerAndVerify();
            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email });
            expect(res.status).toBe(200);

            const token = extractLastResetToken(email);
            expect(token).toMatch(/^[a-f0-9]{64}$/);

            const user = await prisma.user.findUnique({ where: { email } });
            expect(user?.resetTokenHash).toBeTruthy();
            expect(user?.resetTokenHash).not.toBe(token);
            expect(user?.resetTokenExpires).toBeTruthy();
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        it('200 — resets the password, revokes all refresh tokens and emails the confirmation', async () => {
            const { email, refreshToken } = await registerAndVerify();
            await request(app).post('/api/v1/auth/forgot-password').send({ email });
            const token = extractLastResetToken(email);

            const newPassword = 'NewPassword456!';
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({ token, newPassword });
            expect(res.status).toBe(200);

            const user = await prisma.user.findUnique({ where: { email } });
            expect(user?.resetTokenHash).toBeNull();
            expect(user?.resetTokenExpires).toBeNull();

            expect(emailServiceMock.sendPasswordChangeEmail).toHaveBeenCalledWith(
                email,
                expect.any(String),
            );

            const oldLoginFails = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email, password: 'StrongPass123!' });
            expect(oldLoginFails.status).toBe(401);

            // Reset revokes all active refresh tokens — the pre-reset token must
            // no longer refresh, verified before any new login creates new ones.
            const oldRefreshRevoked = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken });
            expect(oldRefreshRevoked.status).toBe(401);

            const newLoginWorks = await request(app)
                .post('/api/v1/auth/login')
                .set('x-client-platform', 'mobile')
                .send({ email, password: newPassword });
            expect(newLoginWorks.status).toBe(200);
        });

        it('404 — INVALID_TOKEN for an unknown token', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({ token: 'a'.repeat(64), newPassword: 'NewPassword456!' });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('INVALID_TOKEN');
        });

        it('400 — short new passwords rejected by validation', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({ token: 'a'.repeat(64), newPassword: 'short' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('GET /api/v1/auth/me', () => {
        it('401 — MISSING_TOKEN without credentials', async () => {
            const res = await request(app).get('/api/v1/auth/me');
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('MISSING_TOKEN');
        });

        it('401 — INVALID_TOKEN for a garbage token', async () => {
            const res = await request(app)
                .get('/api/v1/auth/me')
                .set(authHeader('not-a-token'));
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('INVALID_TOKEN');
        });

        it('200 — returns the user and caches the payload', async () => {
            const user = await registerAndVerify();

            const res = await request(app).get('/api/v1/auth/me').set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe(user.email);
            expect(res.body.profileComplete).toBe(false);
            expect(res.body.user.memberships).toEqual([]);

            expect(fakeRedis.has(cacheKeys.userMe(user.userId))).toBe(true);
        });

        it('serves the cached payload and flips when the cache is invalidated', async () => {
            const user = await registerAndVerify();

            await request(app).get('/api/v1/auth/me').set(authHeader(user.accessToken));

            // Change the DB behind the cache's back — /me should still return the cached user.
            await prisma.user.update({ where: { id: user.userId }, data: { fullName: 'Cached Name' } });
            const cachedHit = await request(app).get('/api/v1/auth/me').set(authHeader(user.accessToken));
            expect(cachedHit.body.user.fullName).toBeNull();

            await CacheService.delete(cacheKeys.userMe(user.userId));
            const fresh = await request(app).get('/api/v1/auth/me').set(authHeader(user.accessToken));
            expect(fresh.body.user.fullName).toBe('Cached Name');
        });

        it('404 — USER_NOT_FOUND when the account was deleted', async () => {
            const user = await registerAndVerify();
            await prisma.user.delete({ where: { id: user.userId } });

            const res = await request(app).get('/api/v1/auth/me').set(authHeader(user.accessToken));
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('USER_NOT_FOUND');
        });
    });

    describe('auth rate limiting', () => {
        it('429 — the auth limiter trips after 5 failed attempts in the window', async () => {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const res = await request(app)
                    .post('/api/v1/auth/verify-email')
                    .send({ email: `${randomUUID()}@test.com`, otp: '000000' });
                expect(res.status).toBe(400);
            }
            const limited = await request(app)
                .post('/api/v1/auth/verify-email')
                .send({ email: `${randomUUID()}@test.com`, otp: '000000' });
            expect(limited.status).toBe(429);
            expect(limited.body.status).toBe('error');
            expect(limited.body.message).toContain('authentication');
        });
    });
});