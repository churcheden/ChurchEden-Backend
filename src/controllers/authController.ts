import type { Request, Response } from "express";
import { prisma } from '../config/prisma.js'
import { comparePasswords, hashPassword } from '../utils/password.js'
import { verifyRefreshToken } from "../utils/jwt.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import crypto from 'crypto';
import { env } from "../env.js";
import { emailService } from "../services/email.service.js";
import { generateOTP } from "../utils/otp.js";
import { wideLogger } from "../utils/wideLogger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { CacheService, cacheKeys } from "../utils/cache.js";
import {
    clearAuthCookies,
    issueAuthTokens,
    revokeRefreshToken,
    revokeUserSession,
    setAuthCookies,
} from "../utils/authSession.js";

const getRefreshTokenFromRequest = (req: Request) => {
    const platform = req.headers['x-client-platform'];
    if (platform === 'web') return req.cookies?.refreshToken || null;
    return req.body.refreshToken || req.cookies?.refreshToken || null;
};

// Register User
export const registerUser = catchAsync(async(req: Request, res: Response) => {
        const { email: rawEmail, password } = req.body;
        const email = rawEmail.trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if(existingUser) {
            throw new AppError('User already exists!', 400, 'USER_EXISTS');
        };

        const hashedPassword = await hashPassword(password);
        const otp = generateOTP();
        const otpHash = await hashPassword(otp);

        // Pending registration lives in Redis only — no User row is created until OTP verification.
        await CacheService.set(
            cacheKeys.pendingRegistration(email),
            { hashedPassword, otpHash, attempts: 0, createdAt: Date.now() },
            600, // 10 min TTL — Redis expires it automatically, no cleanup job
        );

        const firstName = email.split('@')[0] ?? 'there';
        const otpSent = await emailService.sendVerificationOTPEmail(email, otp, firstName);

        if (!otpSent) {
            wideLogger.addCtx('register_result', 'verification_email_failed');
            throw new AppError(
                'Could not send verification email. Please try again.',
                503,
                'EMAIL_SEND_FAILED',
            );
        }

        wideLogger.addCtx('action', 'user_registered');
        wideLogger.addCtx('verification_email_sent_to', email);
        return res.status(201).json({
            status: 'success',
            message: 'Check your email for the verification code.',
            requiresVerification: true,
        });
});

// Verify Email with OTP
export const verifyEmail = catchAsync(async(req: Request, res: Response ) => {
    const { otp, email: rawEmail } = req.body;
    const email = rawEmail?.trim().toLowerCase();

    if(!otp || typeof otp !== 'string') {
        wideLogger.addCtx('verify_email_result', 'fail');
        throw new AppError('Verification OTP is required!', 400, 'MISSING_OTP');
    };
    if(!email) {
        wideLogger.addCtx('verify_email_result', 'fail');
        throw new AppError('Verification email is required!', 400, 'MISSING_EMAIL');
    };

    const cacheKey = cacheKeys.pendingRegistration(email);
    const pending = await CacheService.get<{
        hashedPassword: string;
        otpHash: string;
        attempts: number;
        createdAt?: number;
    }>(cacheKey);

    if(!pending) {
        wideLogger.addCtx('verify_email_result', 'fail');
        throw new AppError(
            'Verification code expired or invalid, please register again.',
            400,
            'PENDING_REGISTRATION_NOT_FOUND',
        );
    }

    const isMatch = await comparePasswords(otp, pending.otpHash);

    if(!isMatch) {
        pending.attempts += 1;

        if(pending.attempts >= 5) {
            await CacheService.delete(cacheKey);
            wideLogger.addCtx('verify_email_result', 'too_many_attempts');
            throw new AppError('Too many incorrect attempts. Please register again.', 400, 'TOO_MANY_ATTEMPTS');
        }

        const remainingTtl = await CacheService.ttl(cacheKey);
        await CacheService.set(cacheKey, pending, remainingTtl > 0 ? remainingTtl : 600);
        wideLogger.addCtx('verify_email_result', 'fail');
        throw new AppError('Invalid OTP, please enter the right OTP', 400, 'INVALID_OTP');
    };

    const newUser = await prisma.user.create({
        data: {
            email,
            password: pending.hashedPassword,
            isVerified: true,
        }
    });

    const { accessToken, refreshToken } = await issueAuthTokens({
        id: newUser.id,
        email: newUser.email,
    });

    setAuthCookies(res, accessToken, refreshToken);

    const firstName = newUser.email.split('@')[0] ?? 'there';
    await emailService.sendWelcomeEmail({
        firstName,
        email: newUser.email,
        signInUrl: `${env.FRONTEND_URL}/onboarding/sign-in`,
    });

    await CacheService.delete(cacheKey);

    wideLogger.addCtx('user_id', newUser.id);
    wideLogger.addCtx('verify_email_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Email verified successfully!',
        accessToken,
        refreshToken,
        user: {
            id: newUser.id,
            email: newUser.email,
            isVerified: newUser.isVerified,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt,
        },
    });
});


// Login User
export const loginUser = catchAsync(async(req: Request, res: Response) => {
        wideLogger.addCtx('action', 'user_login');
        const { email, password } = req.body;
        
        wideLogger.addCtx('email', email);

        const user = await prisma.user.findUnique({
            where: { email } 
        });

        if(!user) {
            wideLogger.addCtx('login_fail_reason', 'user_not_found');
            throw new AppError('Invalid email or password!', 401, 'UNAUTHORIZED');
        };

        const isValidatedPassword =
            user.password != null ? await comparePasswords(password, user.password) : false;

        if(!isValidatedPassword) {
            wideLogger.addCtx('user_id', user.id);
            wideLogger.addCtx('login_fail_reason', 'invalid_password');
            throw new AppError('Invalid email or password!', 401, 'UNAUTHORIZED');
        };

        if(!user.isVerified && user.loginProvider === 'EMAIL') {
            wideLogger.addCtx('user_id', user.id);
            wideLogger.addCtx('login_fail_reason', 'email_not_verified');
            throw new AppError('Please verify your email before signing in.', 403, 'EMAIL_NOT_VERIFIED');
        };

        wideLogger.addCtx('user_id', user.id);

        const { accessToken, refreshToken } = await issueAuthTokens({
            id: user.id,
            email: user.email,
        });

        setAuthCookies(res, accessToken, refreshToken);

        wideLogger.addCtx('login_success', true);
        return res.status(200).json({
            status: 'success',
            message: "Signed in successfully.",
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                isVerified: user.isVerified,
                loginProvider: user.loginProvider,
            }
        });
});

// Forgot Password
export const forgotPassword = catchAsync(async(req: Request, res: Response) => {
    wideLogger.addCtx('action', 'forgot_password');
    const { email } = req.body;
    wideLogger.addCtx('email', email);

    const user = await prisma.user.findUnique({ where: { email } });

     const silentOk = () => res.status(200).json({
        message: 'If user email exists, a reset link has been sent.'
    });

    if(!user) {
        wideLogger.addCtx('forgot_pwd_result', 'user_not_found_silent');
        return silentOk();
    };

    wideLogger.addCtx('user_id', user.id);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetTokenHash: hashedToken,
            resetTokenExpires: new Date(Date.now() + 900000),
        }
    });

    const sent = await emailService.sendPasswordResetEmail(email, resetToken);

    if(!sent) {
        wideLogger.addCtx('forgot_pwd_result', 'email_send_failed');
        throw new AppError('Failed to send reset password email!', 500, 'EMAIL_SEND_FAILED');
    };

    wideLogger.addCtx('forgot_pwd_result', 'success');
    return silentOk();
});

// Reset Password
export const resetPassword = catchAsync(async(req: Request, res: Response) => {
        wideLogger.addCtx('action', 'reset_password');
        const { token, newPassword } = req.body;

        if(!token || !newPassword) {
            wideLogger.addCtx('reset_password_result', 'missing_fields');
            throw new AppError('Token and new password are required!', 400, 'MISSING_FIELDS');
        };

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findFirst({
            where: {
                resetTokenHash: hashedToken,
                resetTokenExpires: { gt: new Date() }
            }
        });

        if(!user) {
            wideLogger.addCtx('reset_password_result', 'invalid_token');
            throw new AppError('Invalid or expired token', 404, 'INVALID_TOKEN');
        };

        wideLogger.addCtx('user_id', user.id);
        const hashedNewPassword = await hashPassword(newPassword);

        await prisma.$transaction([
            prisma.user.update({
                where: {id: user.id},
                data: {
                    password: hashedNewPassword,
                    resetTokenHash: null,
                    resetTokenExpires: null,
                }
            }),
            prisma.refreshToken.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);

        const username = user.fullName?.split(' ')[0] || 'User';
        await emailService.sendPasswordChangeEmail(user.email, username);

        wideLogger.addCtx('reset_password_result', 'success');
        return res.status(200).json({
            message: 'Password reset successful!'
        });
});

// Refresh Token
export const refreshToken = catchAsync(async(req: Request, res: Response) => {
        wideLogger.addCtx('action', 'refresh_token');
        const refreshTokenValue = getRefreshTokenFromRequest(req);

        if(!refreshTokenValue) {
            wideLogger.addCtx('refresh_token_result', 'missing_token');
            throw new AppError("Refresh token required!", 401, 'MISSING_TOKEN');
        };

        const payload = await verifyRefreshToken(refreshTokenValue);

        const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, email: true },
        });

        if(!user) {
            wideLogger.addCtx('refresh_token_result', 'invalid_user_or_expired');
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        };

        const storedTokens = await prisma.refreshToken.findMany({
            where: {
                userId: user.id,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        let matchedRecord: { id: string } | null = null;
        for (const record of storedTokens) {
            if (await comparePasswords(refreshTokenValue, record.tokenHash)) {
                matchedRecord = record;
                break;
            }
        }

        if(!matchedRecord) {
            wideLogger.addCtx('refresh_token_result', 'mismatch');
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        };

        wideLogger.addCtx('user_id', user.id);

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            await issueAuthTokens({
                id: user.id,
                email: user.email,
            });

        // Rotate: the used refresh token is single-use
        await revokeRefreshToken(matchedRecord.id);

        setAuthCookies(res, newAccessToken, newRefreshToken);

        wideLogger.addCtx('refresh_token_result', 'success');
        return res.status(200).json({
            status: 'success',
            data: {
                newAccessToken,
                newRefreshToken
            }
        });
});

// Google OAuth — returns the URL the frontend should redirect the browser to
export const getGoogleAuthUrl = catchAsync(async(req: Request, res: Response) => {
    const url = `${req.protocol}://${req.get('host')}/api/v1/auth/google`;

    return res.status(200).json({
        status: 'success',
        url,
    });
});

// Callback Url
export const googleCallback = catchAsync(async(req: AuthenticatedRequest, res: Response): Promise<void | Response> => {
        wideLogger.addCtx('action', 'google_callback');
        const user = req.user;
        const frontendUrl = env.FRONTEND_URL;

        if(!user) {
            wideLogger.addCtx('google_auth_result', 'no_user');
            return res.redirect(`${frontendUrl}/sign-in?error=auth_failed`);
        };

        wideLogger.addCtx('user_id', user.id);
        wideLogger.addCtx('email', user.email);

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                createdAt: true,
            },
        });

        const isNewUser = dbUser && (Date.now() - dbUser.createdAt.getTime()) < 120_000;
        if (isNewUser && dbUser) {
            const firstName = dbUser.fullName?.split(' ')[0] ?? dbUser.email.split('@')[0] ?? 'there';
            const welcomeSent = await emailService.sendWelcomeEmail({
                firstName,
                ...(dbUser.fullName ? { fullName: dbUser.fullName } : {}),
                email: dbUser.email,
                signInUrl: `${frontendUrl}/onboarding/sign-in`,
            });

            wideLogger.addCtx('welcome_email_sent_to', dbUser.email);
            wideLogger.addCtx('welcome_email_sent', welcomeSent);
        }

        const { accessToken, refreshToken } = await issueAuthTokens({
            id: user.id,
            email: user.email,
        });

        setAuthCookies(res, accessToken, refreshToken);

        wideLogger.addCtx('google_auth_result', 'success');
        return res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
});

export const resendVerificationEmail = catchAsync(async(req: Request, res: Response) => {
        wideLogger.addCtx('action', 'resend_verification_email');

        const { email: rawEmail } = req.body;
        const email = rawEmail?.trim().toLowerCase();

        if(!email) {
            wideLogger.addCtx('resend_verification_result', 'missing_email');
            throw new AppError('Verification email is required!', 400, 'MISSING_EMAIL');
        };

        const cacheKey = cacheKeys.pendingRegistration(email);
        const pending = await CacheService.get<{
            hashedPassword: string;
            otpHash: string;
            attempts: number;
            createdAt?: number;
        }>(cacheKey);

        if(!pending) {
            wideLogger.addCtx('resend_verification_result', 'pending_not_found');
            throw new AppError(
                'No pending registration found for this email.',
                400,
                'PENDING_REGISTRATION_NOT_FOUND',
            );
        };

        const otp = generateOTP();
        pending.otpHash = await hashPassword(otp);
        pending.attempts = 0;
        await CacheService.set(cacheKey, pending, 600);

        const otpSent = await emailService.sendVerificationOTPEmail(
            email,
            otp,
            email.split('@')[0],
        );

        if (!otpSent) {
            wideLogger.addCtx('resend_verification_result', 'email_send_failed');
            throw new AppError(
                'Could not send verification email. Please try again later.',
                503,
                'EMAIL_SEND_FAILED',
            );
        }

        wideLogger.addCtx('resend_verification_result', 'success');
        wideLogger.addCtx('verification_email_sent_to', email);
        return res.status(200).json({
            message: 'Verification OTP sent to your email!'
        });
});

// Logout
export const logoutUser = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'user_logout');

    let userId = req.user?.id;

    if (!userId) {
        const refreshTokenValue = getRefreshTokenFromRequest(req);

        if (refreshTokenValue) {
            try {
                const payload = await verifyRefreshToken(refreshTokenValue);
                userId = payload.id;
            } catch {
                wideLogger.addCtx('logout_result', 'invalid_refresh_token');
            }
        }
    }

    if (userId) {
        wideLogger.addCtx('user_id', userId);
        await revokeUserSession(userId);
        await CacheService.delete(cacheKeys.userMe(userId));
        await CacheService.invalidatePattern(`user:${userId}:*`);
    }

    clearAuthCookies(res);

    wideLogger.addCtx('logout_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: "User logged out successfully!",
    });
});

export const getCurrentUser = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
        wideLogger.addCtx('action', 'get_current_user');
        
        if (!req.user) {
            wideLogger.addCtx('get_user_result', 'unauthorized');
            throw new AppError('User not authenticated!', 401, 'UNAUTHORIZED');
        };

        const userId = req.user.id;
        wideLogger.addCtx('user_id', userId);

        // Try to get from cache first
        const cacheKey = cacheKeys.userMe(userId);
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            wideLogger.addCtx('cache_hit', true);
            return res.status(200).json(cached);
        }

        const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    isVerified: true,
                    isPremium: true,
                    premiumExpiry: true,
                    loginProvider: true,
                    lastLogin: true,
                    createdAt: true,
                }
            });

        if (!user) {
            wideLogger.addCtx('get_user_result', 'user_not_found');
            throw new AppError('User not found!', 404, 'USER_NOT_FOUND');
        };
        wideLogger.addCtx('cache_hit', false);

        const result = {
            status: 'success',
            user,
        };

        await CacheService.set(cacheKey, result, 600);
        wideLogger.addCtx('get_user_result', 'success');
        return res.status(200).json(result);
});
