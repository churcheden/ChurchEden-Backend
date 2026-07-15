import type { Response } from 'express';
import { env } from '../env.js';
import { prisma } from '../config/prisma.js';
import { hashPassword } from './password.js';
import { generateAccessToken, generateRefreshToken } from './jwt.js';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = (maxAge: number) => ({
    httpOnly: true,
    secure: env.APP_STAGE === 'production',
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
        secure: env.APP_STAGE === 'production',
        sameSite: 'strict' as const,
    };

    res.clearCookie('token', baseOptions);
    res.clearCookie('refreshToken', baseOptions);
};

export const issueAuthTokens = async (user: { id: string; email: string }) => {
    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken({ id: user.id, email: user.email }),
        generateRefreshToken({ id: user.id, email: user.email }),
    ]);

    const hashedRefreshToken = await hashPassword(refreshToken);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            refreshToken: hashedRefreshToken,
            refreshTokenExpires: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
            lastLogin: new Date(),
        },
    });

    return { accessToken, refreshToken };
};

export const revokeUserSession = async (userId: string) => {
    await prisma.user.update({
        where: { id: userId },
        data: {
            refreshToken: null,
            refreshTokenExpires: null,
        },
    });
};
