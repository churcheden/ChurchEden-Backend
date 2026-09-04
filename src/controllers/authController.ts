import type { Request, Response } from "express";
import { prisma } from '../config/prisma.js'
import { comparePasswords, hashPassword } from '../utils/password.js'
import { verifyRefreshToken, verifyAccessToken } from "../utils/jwt.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { extractAccessToken } from "../middleware/auth.middleware.js";
import crypto from 'crypto';
import { env } from "../env.js";
import { emailService } from "../services/email.service.js";
import { generateOTP } from "../utils/otp.js";
import { verifyGoogleIdToken } from "../services/googleOAuth.service.js";
import { isAllowedMobileCallback, parseOAuthState } from "../utils/oauthState.js";
import { wideLogger } from "../utils/wideLogger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { CacheService, cacheKeys } from "../utils/cache.js";
import {
    clearAuthCookies,
    issueAdminAuthTokens,
    issueAuthTokens,
    revokeAdminRefreshToken,
    revokeAdminSession,
    revokeRefreshToken,
    revokeUserSession,
    setAuthCookies,
} from "../utils/authSession.js";

const getRefreshTokenFromRequest = (req: Request) => {
    const platform = req.headers['x-client-platform'];
    if (platform === 'web') return req.cookies?.refreshToken || null;
    return req.body?.refreshToken || req.cookies?.refreshToken || null;
};

const resetTokenHashesMatch = (hashedToken: string, storedHash: string): boolean => {
    const a = Buffer.from(hashedToken, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
};

// Register SuperAdmin (church owner)
export const registerUser = catchAsync(async(req: Request, res: Response) => {
        const { email: rawEmail, password } = req.body;
        const email = rawEmail.trim().toLowerCase();

        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if(existingSuperAdmin) {
            throw new AppError('Admin already exists!', 400, 'ADMIN_EXISTS');
        };

        const hashedPassword = await hashPassword(password);
        const otp = generateOTP();
        const otpHash = await hashPassword(otp);

        // Pending registration lives in Redis only — no SuperAdmin row is created until OTP verification.
        await CacheService.set(
            cacheKeys.pendingRegistration(email),
            { hashedPassword, otpHash, attempts: 0, createdAt: Date.now() },
            600,
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

// Verify Email with OTP — creates the SuperAdmin row
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

    const newAdmin = await prisma.superAdmin.create({
        data: {
            email,
            password: pending.hashedPassword,
            isVerified: true,
        }
    });

    const { accessToken, refreshToken } = await issueAdminAuthTokens({
        id: newAdmin.id,
        adminId: newAdmin.id,
        email: newAdmin.email,
    });

    setAuthCookies(res, accessToken, refreshToken);

    const firstName = newAdmin.email.split('@')[0] ?? 'there';
    await emailService.sendWelcomeEmail({
        firstName,
        email: newAdmin.email,
        signInUrl: `${env.FRONTEND_URL}/onboarding/sign-in`,
    });

    await CacheService.delete(cacheKey);

    wideLogger.addCtx('user_id', newAdmin.id);
    wideLogger.addCtx('verify_email_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Email verified successfully!',
        accessToken,
        refreshToken,
        user: {
            id: newAdmin.id,
            email: newAdmin.email,
            isVerified: newAdmin.isVerified,
            createdAt: newAdmin.createdAt,
            updatedAt: newAdmin.updatedAt,
        },
    });
});


// Login User
export const loginUser = catchAsync(async (req: Request, res: Response) => {
    wideLogger.addCtx('action', 'user_login');
    const { email, password } = req.body;

    wideLogger.addCtx('email', email);

    const platform = (req.headers['x-client-platform'] as string) || 'web';
    const isWeb = platform === 'web';

    // Account-type routing:
    //  - WEB always authenticates against SuperAdmin only. Plain members
    //    have no web login under this design.
    //  - MOBILE tries SuperAdmin first, then falls back to Member — an admin may also
    //    want to authenticate on the mobile app.
    let superAdmin = await prisma.superAdmin.findUnique({ where: { email } });
    let member: { id: string; email: string; isVerified: boolean; password: string | null; churchId: string | null } | null = null;

    if (!superAdmin && !isWeb) {
        member = await prisma.member.findUnique({ where: { email } });
    }

    if (superAdmin) {
        const valid = superAdmin.password != null ? await comparePasswords(password, superAdmin.password) : false;
        if (!valid) {
            wideLogger.addCtx('login_fail_reason', 'admin_invalid_password');
            throw new AppError('Invalid email or password!', 401, 'UNAUTHORIZED');
        }
        if (!superAdmin.isVerified && superAdmin.loginProvider === 'EMAIL') {
            wideLogger.addCtx('login_fail_reason', 'admin_email_not_verified');
            throw new AppError('Please verify your email before signing in.', 403, 'EMAIL_NOT_VERIFIED');
        }

        wideLogger.addCtx('admin_id', superAdmin.id);

        const { accessToken, refreshToken } = await issueAdminAuthTokens({
            id: superAdmin.id,
            adminId: superAdmin.id,
            email: superAdmin.email,
        });

        setAuthCookies(res, accessToken, refreshToken);

        wideLogger.addCtx('login_success', true);
        wideLogger.addCtx('account_type', 'ADMIN');
        return res.status(200).json({
            status: 'success',
            message: 'Signed in successfully.',
            accessToken,
            refreshToken,
            accountType: 'ADMIN',
            user: {
                id: superAdmin.id,
                adminId: superAdmin.id,
                email: superAdmin.email,
                fullName: superAdmin.fullName,
                isVerified: superAdmin.isVerified,
                loginProvider: superAdmin.loginProvider,
            },
        });
    }

    // MEMBER fallback (mobile only)
    if (member) {
        const isValidatedPassword = member.password != null ? await comparePasswords(password, member.password) : false;
        if (!isValidatedPassword) {
            wideLogger.addCtx('user_id', member.id);
            wideLogger.addCtx('login_fail_reason', 'invalid_password');
            throw new AppError('Invalid email or password!', 401, 'UNAUTHORIZED');
        }

        if (!member.isVerified) {
            wideLogger.addCtx('user_id', member.id);
            wideLogger.addCtx('login_fail_reason', 'email_not_verified');
            throw new AppError('Please verify your email before signing in.', 403, 'EMAIL_NOT_VERIFIED');
        }

        wideLogger.addCtx('user_id', member.id);
        const { accessToken, refreshToken } = await issueAuthTokens({ id: member.id, email: member.email });
        setAuthCookies(res, accessToken, refreshToken);

        wideLogger.addCtx('login_success', true);
        wideLogger.addCtx('account_type', 'MEMBER');
        return res.status(200).json({
            status: 'success',
            message: 'Signed in successfully.',
            accessToken,
            refreshToken,
            accountType: 'MEMBER',
            user: {
                id: member.id,
                email: member.email,
                isVerified: member.isVerified,
                churchId: member.churchId,
            },
        });
    }

    if (!superAdmin && !member && isWeb) {
        wideLogger.addCtx('login_fail_reason', 'not_found');
        throw new AppError('Invalid email or password!', 401, 'UNAUTHORIZED');
    }

    throw new AppError('Invalid email or password!', 401, 'UNAUTHORIZED');
});

// Forgot Password — SuperAdmin only (only SuperAdmin has reset token fields)
export const forgotPassword = catchAsync(async(req: Request, res: Response) => {
    wideLogger.addCtx('action', 'forgot_password');
    const { email } = req.body;
    wideLogger.addCtx('email', email);

    const superAdmin = await prisma.superAdmin.findUnique({ where: { email } });

     const silentOk = () => res.status(200).json({
        message: 'If user email exists, a reset link has been sent.'
    });

    if(!superAdmin) {
        wideLogger.addCtx('forgot_pwd_result', 'user_not_found_silent');
        return silentOk();
    };

    wideLogger.addCtx('user_id', superAdmin.id);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.superAdmin.update({
        where: { id: superAdmin.id },
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

// Reset Password — SuperAdmin only
export const resetPassword = catchAsync(async(req: Request, res: Response) => {
        wideLogger.addCtx('action', 'reset_password');
        const { token, newPassword } = req.body;

        if(!token || !newPassword) {
            wideLogger.addCtx('reset_password_result', 'missing_fields');
            throw new AppError('Token and new password are required!', 400, 'MISSING_FIELDS');
        };

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const candidates = await prisma.superAdmin.findMany({
            where: {
                resetTokenHash: { not: null },
                resetTokenExpires: { gt: new Date() }
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                resetTokenHash: true,
            },
        });

        const superAdmin = candidates.find(
            (candidate) =>
                candidate.resetTokenHash != null &&
                resetTokenHashesMatch(hashedToken, candidate.resetTokenHash),
        ) ?? null;

        if(!superAdmin) {
            wideLogger.addCtx('reset_password_result', 'invalid_token');
            throw new AppError('Invalid or expired token', 404, 'INVALID_TOKEN');
        };

        wideLogger.addCtx('user_id', superAdmin.id);
        const hashedNewPassword = await hashPassword(newPassword);

        await prisma.$transaction([
            prisma.superAdmin.update({
                where: {id: superAdmin.id},
                data: {
                    password: hashedNewPassword,
                    resetTokenHash: null,
                    resetTokenExpires: null,
                }
            }),
            prisma.superAdminRefreshToken.updateMany({
                where: { superAdminId: superAdmin.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);

        const username = superAdmin.fullName?.split(' ')[0] || 'User';
        await emailService.sendPasswordChangeEmail(superAdmin.email, username);

        wideLogger.addCtx('reset_password_result', 'success');
        return res.status(200).json({
            message: 'Password reset successful!'
        });
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


// Refresh Token
export const refreshToken = catchAsync(async(req: Request, res: Response) => {
        wideLogger.addCtx('action', 'refresh_token');
        const refreshTokenValue = getRefreshTokenFromRequest(req);

        if(!refreshTokenValue) {
            wideLogger.addCtx('refresh_token_result', 'missing_token');
            throw new AppError("Refresh token required!", 401, 'MISSING_TOKEN');
        };

        let payload;
        try {
            payload = await verifyRefreshToken(refreshTokenValue);
        } catch {
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        }

        const accountType = payload.accountType === 'ADMIN' ? 'ADMIN' : 'MEMBER';

        if (accountType === 'ADMIN') {
            const superAdmin = await prisma.superAdmin.findUnique({
                where: { id: payload.id },
                select: { id: true, email: true },
            });

            if (!superAdmin) {
                wideLogger.addCtx('refresh_token_result', 'invalid_admin_or_expired');
                throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
            }

            const storedTokens = await prisma.superAdminRefreshToken.findMany({
                where: {
                    superAdminId: superAdmin.id,
                    revokedAt: null,
                    expiresAt: { gt: new Date() },
                },
            });

            let matchedRecord: { id: string } | null = null;
            const candidateHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
            for (const record of storedTokens) {
                if (resetTokenHashesMatch(candidateHash, record.tokenHash)) {
                    matchedRecord = record;
                    break;
                }
            }

            if (!matchedRecord) {
                wideLogger.addCtx('refresh_token_result', 'mismatch');
                throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
            }

            wideLogger.addCtx('admin_id', superAdmin.id);

            const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
                await issueAdminAuthTokens({
                    id: superAdmin.id,
                    adminId: superAdmin.id,
                    email: superAdmin.email,
                });

            await revokeAdminRefreshToken(matchedRecord.id);
            setAuthCookies(res, newAccessToken, newRefreshToken);

            wideLogger.addCtx('refresh_token_result', 'success');
            return res.status(200).json({
                status: 'success',
                accountType: 'ADMIN',
                data: { newAccessToken, newRefreshToken },
            });
        }

        const member = await prisma.member.findUnique({
            where: { id: payload.id },
            select: { id: true, email: true },
        });

        if(!member) {
            wideLogger.addCtx('refresh_token_result', 'invalid_user_or_expired');
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        };

        const storedTokens = await prisma.memberRefreshToken.findMany({
            where: {
                memberId: member.id,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        let matchedRecord: { id: string } | null = null;
        const candidateHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
        for (const record of storedTokens) {
            if (resetTokenHashesMatch(candidateHash, record.tokenHash)) {
                matchedRecord = record;
                break;
            }
        }

        if(!matchedRecord) {
            wideLogger.addCtx('refresh_token_result', 'mismatch');
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        };

        wideLogger.addCtx('user_id', member.id);

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            await issueAuthTokens({
                id: member.id,
                email: member.email,
            });

        await revokeRefreshToken(matchedRecord.id);

        setAuthCookies(res, newAccessToken, newRefreshToken);

        wideLogger.addCtx('refresh_token_result', 'success');
        return res.status(200).json({
            status: 'success',
            accountType: 'MEMBER',
            data: {
                newAccessToken,
                newRefreshToken
            }
        });
});

// Google OAuth — returns the URL the frontend should redirect the browser to
export const getGoogleAuthUrl = catchAsync(async(req: Request, res: Response) => {
    const platform = (req.query.platform as string) || (req.headers['x-client-platform'] as string) || 'web';
    const redirect = typeof req.query.redirect === 'string' && isAllowedMobileCallback(req.query.redirect)
        ? req.query.redirect   // keep raw — buildOAuthState embeds it; parseOAuthState decodes on callback
        : '';
    const url = `${req.protocol}://${req.get('host')}/api/v1/auth/google?platform=${encodeURIComponent(platform)}${
        redirect ? `&redirect=${redirect}` : ''
    }`;

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
        const { platform, redirect } = parseOAuthState((req.query.state as string) || '');

        if(!user) {
            wideLogger.addCtx('google_auth_result', 'no_user');
            if (platform === 'mobile') {
                return res.redirect(`${redirect || 'churcheden://auth/callback'}?error=auth_failed`);
            }
            return res.redirect(`${frontendUrl}/onboarding/sign-in?error=auth_failed`);
        };

        // WEB google sign-in is admin-only. The passport strategy already
        // authenticated against SuperAdmin. Issue an ADMIN session.
        if (platform === 'web') {
            const superAdmin = await prisma.superAdmin.findUnique({
                where: { id: user.id },
                select: { id: true, email: true, fullName: true, googleId: true },
            });

            if (!superAdmin) {
                wideLogger.addCtx('google_admin_result', 'not_an_admin');
                return res.redirect(`${frontendUrl}/onboarding/sign-in?error=not_an_admin`);
            }

            wideLogger.addCtx('admin_id', superAdmin.id);
            const { accessToken, refreshToken } = await issueAdminAuthTokens({
                id: superAdmin.id,
                adminId: superAdmin.id,
                email: superAdmin.email,
            });

            setAuthCookies(res, accessToken, refreshToken);

            // A SuperAdmin's "profile" is complete once they have onboarded a
            // church (church onboarding step-1..complete creates the Church
            // owned by this SuperAdmin). Fresh Google sign-ups have no church
            // yet, so redirect them into the church onboarding flow.
            const hasChurch = await prisma.church.findUnique({
                where: { superAdminId: superAdmin.id },
                select: { id: true },
            });

            wideLogger.addCtx('google_admin_result', 'success');
            wideLogger.addCtx('profile_complete', !!hasChurch);
            return res.redirect(`${frontendUrl}/auth/callback?profileComplete=${!!hasChurch}`);
        }

        wideLogger.addCtx('user_id', user.id);
        wideLogger.addCtx('email', user.email);

        const member = await prisma.member.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                email: true,
                isVerified: true,
            },
        });

        if (!member) {
            wideLogger.addCtx('google_auth_result', 'member_not_found');
            if (platform === 'mobile') {
                return res.redirect(`${redirect || 'churcheden://auth/callback'}?error=member_not_found`);
            }
            return res.redirect(`${frontendUrl}/onboarding/sign-in?error=member_not_found`);
        }

        const { accessToken, refreshToken } = await issueAuthTokens({
            id: member.id,
            email: member.email,
        });

        const hasProfile = await prisma.memberProfile.findUnique({
            where: { memberId: member.id },
        });

        wideLogger.addCtx('google_auth_result', 'success');
        wideLogger.addCtx('profile_complete', !!hasProfile);

        if (platform === 'mobile') {
            const callbackUri = redirect || 'churcheden://auth/callback';
            const finalUrl = `${callbackUri}?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&profileComplete=${!!hasProfile}`;
            wideLogger.addCtx('mobile_oauth_final_url', finalUrl);
            return res.redirect(finalUrl);
        }

        setAuthCookies(res, accessToken, refreshToken);
        return res.redirect(`${frontendUrl}/auth/callback?profileComplete=${!!hasProfile}`);
});

// Exchange a Google ID token (from the mobile app) for ChurchEden tokens.
export const exchangeGoogleToken = catchAsync(async(req: Request, res: Response) => {
    wideLogger.addCtx('action', 'google_token_exchange');

    const { idToken, platform, accountType = 'MEMBER', churchId } = req.body as {
        idToken: string;
        platform: 'android' | 'ios' | 'web' | 'expo';
        accountType?: 'ADMIN' | 'MEMBER';
        churchId?: string;
    };

    const clientIdForPlatform =
        platform === 'android'
            ? env.GOOGLE_ANDROID_CLIENT_ID
            : platform === 'ios'
              ? env.GOOGLE_IOS_CLIENT_ID
              : env.GOOGLE_CLIENT_ID;

    const allowedAudiences = [
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_ANDROID_CLIENT_ID,
        env.GOOGLE_IOS_CLIENT_ID,
    ].filter((id): id is string => Boolean(id));

    if (allowedAudiences.length === 0) {
        throw new AppError('Google OAuth is not configured.', 500, 'GOOGLE_NOT_CONFIGURED');
    }

    let payload;
    try {
        payload = await verifyGoogleIdToken(idToken, allowedAudiences);
    } catch {
        throw new AppError('Invalid Google token.', 401, 'INVALID_GOOGLE_TOKEN');
    }

    const email = payload.email?.trim().toLowerCase();
    if (!email) {
        throw new AppError('No email was returned by Google.', 400, 'GOOGLE_EMAIL_REQUIRED');
    }
    if (!payload.email_verified) {
        throw new AppError('Your Google email has not been verified.', 403, 'GOOGLE_EMAIL_NOT_VERIFIED');
    }

    wideLogger.addCtx('google_id', payload.sub);

    // ADMIN-context exchange: authenticate against the SuperAdmin table.
    if (accountType === 'ADMIN') {
        let superAdmin = await prisma.superAdmin.findUnique({ where: { googleId: payload.sub } });
        if (!superAdmin) {
            superAdmin = await prisma.superAdmin.findUnique({ where: { email } });
        }
        if (!superAdmin) {
            throw new AppError('No admin account matches this Google account.', 401, 'ADMIN_NOT_FOUND');
        }
        if (superAdmin.googleId !== payload.sub) {
            superAdmin = await prisma.superAdmin.update({
                where: { id: superAdmin.id },
                data: { googleId: payload.sub, loginProvider: 'GOOGLE', isVerified: true },
            });
        }
        wideLogger.addCtx('admin_id', superAdmin.id);

        const { accessToken, refreshToken } = await issueAdminAuthTokens({
            id: superAdmin.id,
            adminId: superAdmin.id,
            email: superAdmin.email,
        });

        wideLogger.addCtx('google_admin_auth_result', 'success');
        return res.status(200).json({
            status: 'success',
            message: 'Signed in successfully.',
            accessToken,
            refreshToken,
            accountType: 'ADMIN',
            user: {
                id: superAdmin.id,
                adminId: superAdmin.id,
                email: superAdmin.email,
                fullName: superAdmin.fullName,
                isVerified: superAdmin.isVerified,
                loginProvider: superAdmin.loginProvider,
            },
        });
    }

    // MEMBER-context exchange: find or link existing Member, or create new.
    // A Member may be created without a church (churchId is optional); when a
    // churchId is supplied we verify it and attach the Member to that church.
    if (churchId) {
        const church = await prisma.church.findUnique({
            where: { id: churchId },
            select: { id: true },
        });
        if (!church) {
            throw new AppError('Church not found!', 404, 'CHURCH_NOT_FOUND');
        }
    }

    let member = await prisma.member.findUnique({ where: { googleId: payload.sub } });

    if (!member) {
        member = await prisma.member.findUnique({ where: { email } });
        if (member) {
            member = await prisma.member.update({
                where: { id: member.id },
                data: {
                    googleId: payload.sub,
                    isVerified: true,
                    ...(churchId ? { churchId } : {}),
                },
            });
        }
    }

    if (!member) {
        member = await prisma.member.create({
            data: {
                email,
                googleId: payload.sub,
                isVerified: true,
                ...(churchId ? { churchId } : {}),
            },
        });
    }

    wideLogger.addCtx('user_id', member.id);

    const { accessToken, refreshToken } = await issueAuthTokens({
        id: member.id,
        email: member.email,
    });

    const hasProfile = await prisma.memberProfile.findUnique({
        where: { memberId: member.id },
    });

    wideLogger.addCtx('google_auth_result', 'success');
    wideLogger.addCtx('profile_complete', !!hasProfile);

    return res.status(200).json({
        status: 'success',
        message: 'Signed in successfully.',
        accessToken,
        refreshToken,
        profileComplete: !!hasProfile,
        user: {
            id: member.id,
            email: member.email,
            isVerified: member.isVerified,
            churchId: member.churchId,
        },
    });
});

// Logout
export const logoutUser = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'user_logout');

    let accountId = req.user?.id;
    let accountType = req.user?.accountType === 'ADMIN' ? 'ADMIN' as const : 'MEMBER' as const;

    if (!accountId) {
        const accessToken = extractAccessToken(req);
        if (accessToken) {
            try {
                const payload = await verifyAccessToken(accessToken);
                accountId = payload.id;
                accountType = payload.accountType === 'ADMIN' ? 'ADMIN' : 'MEMBER';
            } catch {
                wideLogger.addCtx('logout_result', 'invalid_access_token');
            }
        }
    }

    if (!accountId) {
        const refreshTokenValue = getRefreshTokenFromRequest(req);

        if (refreshTokenValue) {
            try {
                const payload = await verifyRefreshToken(refreshTokenValue);
                accountId = payload.id;
                accountType = payload.accountType === 'ADMIN' ? 'ADMIN' : 'MEMBER';
            } catch {
                wideLogger.addCtx('logout_result', 'invalid_refresh_token');
            }
        }
    }

    if (accountId) {
        wideLogger.addCtx('user_id', accountId);
        if (accountType === 'ADMIN') {
            await revokeAdminSession(accountId);
            await CacheService.delete(cacheKeys.userMe(`admin:${accountId}`));
        } else {
            await revokeUserSession(accountId);
            await CacheService.delete(cacheKeys.userMe(accountId));
            await CacheService.invalidatePattern(`user:${accountId}:*`);
        }
    }

    clearAuthCookies(res);

    wideLogger.addCtx('logout_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: "User logged out successfully!",
    });
});

export const getCurrentUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_current_user');

    if (!req.user) {
        wideLogger.addCtx('get_user_result', 'unauthorized');
        throw new AppError('User not authenticated!', 401, 'UNAUTHORIZED');
    }

    const accountType = req.user.accountType === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    const id = req.user.id;
    wideLogger.addCtx('user_id', id);
    wideLogger.addCtx('account_type', accountType);

    if (accountType === 'ADMIN') {
        const cacheKey = cacheKeys.userMe(`admin:${id}`);
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            wideLogger.addCtx('cache_hit', true);
            return res.status(200).json(cached);
        }

        const superAdmin = await prisma.superAdmin.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                fullName: true,
                isVerified: true,
                loginProvider: true,
                lastLogin: true,
                createdAt: true,
                church: { select: { id: true, name: true, logoUrl: true, city: true } },
            },
        });

        if (!superAdmin) {
            wideLogger.addCtx('get_user_result', 'admin_not_found');
            throw new AppError('Admin not found!', 404, 'ADMIN_NOT_FOUND');
        }

        const result = {
            status: 'success',
            accountType: 'ADMIN',
            user: superAdmin,
            profileComplete: false,
        };

        await CacheService.set(cacheKey, result, 600);
        wideLogger.addCtx('get_user_result', 'success');
        return res.status(200).json(result);
    }

    // MEMBER /me
    const cacheKey = cacheKeys.userMe(id);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
        wideLogger.addCtx('cache_hit', true);
        return res.status(200).json(cached);
    }

    const member = await prisma.member.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            isVerified: true,
            role: true,
            status: true,
            joinedAt: true,
            isBanned: true,
            memberProfile: { select: { id: true } },
            church: { select: { id: true, name: true, logoUrl: true, city: true } },
        },
    });

    if (!member) {
        wideLogger.addCtx('get_user_result', 'user_not_found');
        throw new AppError('User not found!', 404, 'USER_NOT_FOUND');
    }
    wideLogger.addCtx('cache_hit', false);

    const { memberProfile, ...memberData } = member;

    const result = {
        status: 'success',
        accountType: 'MEMBER',
        user: memberData,
        profileComplete: !!memberProfile,
    };

    await CacheService.set(cacheKey, result, 600);
    wideLogger.addCtx('get_user_result', 'success');
    return res.status(200).json(result);
});
