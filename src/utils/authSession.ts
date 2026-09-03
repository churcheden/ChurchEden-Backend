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
        generateAccessToken({ id: user.id, email: user.email, accountType: 'MEMBER' }),
        generateRefreshToken({ id: user.id, email: user.email, accountType: 'MEMBER' }),
    ]);

    const hashedRefreshToken = sha256(refreshToken);

    await prisma.memberRefreshToken.create({
        data: {
            memberId: user.id,
            tokenHash: hashedRefreshToken,
            deviceInfo: deviceInfo ?? null,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
        },
    });

    return { accessToken, refreshToken };
};

export interface AdminAuthTokensInput {
    id: string;
    adminId: string;
    email: string;
}

export const issueAdminAuthTokens = async (
    admin: { id: string; adminId: string; email: string },
    deviceInfo?: string,
) => {
    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken({ id: admin.adminId, email: admin.email, accountType: 'ADMIN', adminId: admin.adminId }),
        generateRefreshToken({ id: admin.adminId, email: admin.email, accountType: 'ADMIN', adminId: admin.adminId }),
    ]);

    const hashedRefreshToken = sha256(refreshToken);

    await prisma.superAdminRefreshToken.create({
        data: {
            superAdminId: admin.adminId,
            tokenHash: hashedRefreshToken,
            deviceInfo: deviceInfo ?? null,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
        },
    });

    await prisma.superAdmin.update({
        where: { id: admin.adminId },
        data: { lastLogin: new Date() },
    });

    return { accessToken, refreshToken, accountType: 'ADMIN' as const };
};

export const findActiveRefreshToken = async (memberId: string, hashedToken: string) => {
    return prisma.memberRefreshToken.findFirst({
        where: {
            memberId,
            tokenHash: hashedToken,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
};

export const revokeRefreshToken = async (id: string) => {
    await prisma.memberRefreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};

export const revokeUserSession = async (memberId: string) => {
    await prisma.memberRefreshToken.updateMany({
        where: { memberId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};

export const revokeAdminSession = async (superAdminId: string) => {
    await prisma.superAdminRefreshToken.updateMany({
        where: { superAdminId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};

export const revokeAdminRefreshToken = async (id: string) => {
    await prisma.superAdminRefreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};
