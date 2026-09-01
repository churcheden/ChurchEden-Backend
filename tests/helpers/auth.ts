import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { emailServiceMock } from './fakes.js';

export interface TestUser {
    email: string;
    password: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
}

export const authHeader = (token: string): { Authorization: string } => ({
    Authorization: `Bearer ${token}`,
});

export const accessTokenFor = async (userId: string, email: string): Promise<string> =>
    generateAccessToken({ id: userId, email });

/** An ADMIN JWT for the given Admin row id. id === adminId for admin tokens. */
export const adminAccessTokenFor = async (adminId: string, email: string): Promise<string> =>
    generateAccessToken({ id: adminId, email, accountType: 'ADMIN', adminId });

/** Returns the most recently captured verification OTP for an email. */
export const extractLastOtp = (to: string): string => {
    const calls = emailServiceMock.sendVerificationOTPEmail.mock.calls as [string, string, string?][];
    const match = [...calls].reverse().find(([email]) => email === to);
    if (!match) throw new Error(`No verification OTP captured for ${to}`);
    return match[1];
};

/** Returns the most recently captured password-reset token for an email. */
export const extractLastResetToken = (to: string): string => {
    const calls = emailServiceMock.sendPasswordResetEmail.mock.calls as [string, string][];
    const match = [...calls].reverse().find(([email]) => email === to);
    if (!match) throw new Error(`No password reset email captured for ${to}`);
    return match[1];
};

export const register = async (options: { email?: string; password?: string } = {}): Promise<{
    email: string;
    password: string;
}> => {
    const email = options.email ?? `${randomUUID()}@test.com`;
    const password = options.password ?? 'StrongPass123!';
    const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password });
    if (res.status !== 201) {
        throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return { email, password };
};

/** Registers a user and verifies their email, returning full credentials. */
export const registerAndVerify = async (options: { email?: string; password?: string } = {}): Promise<TestUser> => {
    const email = options.email ?? `${randomUUID()}@test.com`;
    const password = options.password ?? 'StrongPass123!';
    await register({ email, password });
    const otp = extractLastOtp(email);
    const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ email, otp });
    if (verifyRes.status !== 200) {
        throw new Error(`verify failed: ${verifyRes.status} ${JSON.stringify(verifyRes.body)}`);
    }
    return {
        email,
        password,
        userId: verifyRes.body.user.id as string,
        accessToken: verifyRes.body.accessToken as string,
        refreshToken: verifyRes.body.refreshToken as string,
    };
};

export const login = async (email: string, password: string): Promise<TestUser> => {
    const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-client-platform', 'mobile')
        .send({ email, password });
    if (res.status !== 200) {
        throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
        email,
        password,
        userId: res.body.user.id as string,
        accessToken: res.body.accessToken as string,
        refreshToken: res.body.refreshToken as string,
    };
};