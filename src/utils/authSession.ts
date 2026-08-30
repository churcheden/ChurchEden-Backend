import type { Response } from 'express';
import crypto from 'crypto';
import { env } from '../env.js';
import { prisma } from '../config/prisma.js';
import { generateAccessToken, generateRefreshToken } from './jwt.js';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

const cookieOptions = (maxAge: number) => ({
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
});

export const setAuthCookies = (
    res: Response,
    accessToken: string,
    refreshToken: string,
) => {
    res.cookie('token', accessToken, cookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
    res.cookie('refreshToken', refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
};

export const clearAuthCookies = (res: Response) => {
    const baseOptions = {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
    };

    res.clearCookie('token', baseOptions);
    res.clearCookie('refreshToken', baseOptions);
};

export const issueAuthTokens = async (
    user: { id: string; email: string },
    deviceInfo?: string,
) => {
    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken({ id: user.id, email: user.email }),
        generateRefreshToken({ id: user.id, email: user.email }),
    ]);

    // bcrypt truncates input at 72 bytes, and two refresh tokens for the same
    // user differ only near the end of the JWT — so a plain bcrypt hash would
    // be identical for every token a user is issued, defeating rotation and
    // revocation. Hash the full token with SHA-256 instead.
    const hashedRefreshToken = sha256(refreshToken);

    await prisma.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash: hashedRefreshToken,
            deviceInfo: deviceInfo ?? null,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
        },
    });

    await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
    });

    return { accessToken, refreshToken };
};

export const findActiveRefreshToken = async (userId: string, hashedToken: string) => {
    return prisma.refreshToken.findFirst({
        where: {
            userId,
            tokenHash: hashedToken,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
};

export const revokeRefreshToken = async (id: string) => {
    await prisma.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};

export const revokeUserSession = async (userId: string) => {
    await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};
