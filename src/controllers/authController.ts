import type { Request, Response } from "express";
import { prisma } from '../config/prisma.js'
import { comparePasswords, hashPassword } from '../utils/password.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import crypto from 'crypto';
import { env } from "../env.js";
import { emailService } from "../services/email.service.js";
import { generateOTP } from "../utils/otp.js";
import { wideLogger } from "../utils/wideLogger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { CacheService, cacheKeys } from "../utils/cache.js";

// Register User
export const registerUser = catchAsync(async(req: Request, res: Response) => {
        const { email, password } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if(existingUser) {
            throw new AppError('User already exists!', 400, 'USER_EXISTS');
        };

        const hashedPassword = await hashPassword(password);
        const otp = generateOTP();
        const hashedVerifyToken = await hashPassword(otp);

        // Use interactive transaction so user creation + refresh-token write are atomic.
        const { newUser, accessToken, refreshToken } = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    verifyToken: hashedVerifyToken,
                    verifyTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
                }
            });

            const [at, rt] = await Promise.all([
                generateAccessToken({ id: user.id, email: user.email }),
                generateRefreshToken({ id: user.id, email: user.email }),
            ]);

            const hashedRt = await hashPassword(rt);

            await tx.user.update({
                where: { id: user.id },
                data: {
                    refreshToken: hashedRt,
                    refreshTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    lastLogin: new Date(),
                }
            });

            return { newUser: user, accessToken: at, refreshToken: rt };
        });

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });

        await emailService.sendVerificationOTPEmail(newUser.email, otp, newUser.email.split('@')[0]);

        const firstName = newUser.email.split('@')[0] ?? 'there';
        await emailService.sendWelcomeEmail({
            firstName,
            email: newUser.email,
            signInUrl: `${env.FRONTEND_URL}/onboarding/sign-in`,
        });
        
        wideLogger.addCtx('user_id', newUser.id);
        wideLogger.addCtx('action', 'user_registered');
        return res.status(201).json({
            status: 'success',
            message: 'Account created! Check your email for the verification code.',
            requiresVerification: true,
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

        const isValidatedPassword = await comparePasswords(password, user.password);

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

        const accessToken = await generateAccessToken({
            id: user.id,
            email: user.email,
        });

        const refreshToken = await generateRefreshToken({
            id: user.id,
            email: user.email,
        });

        const hashedRefreshToken = await hashPassword(refreshToken)

        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken: hashedRefreshToken,
                refreshTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                lastLogin: new Date()
            }
        });

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

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
            resetToken: hashedToken,
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
                resetToken: hashedToken,
                resetTokenExpires: { gt: new Date() }
            }
        });

        if(!user) {
            wideLogger.addCtx('reset_password_result', 'invalid_token');
            throw new AppError('Invalid or expired token', 404, 'INVALID_TOKEN');
        };

        wideLogger.addCtx('user_id', user.id);
        const hashedNewPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: {id: user.id},
            data: {
                password: hashedNewPassword,
                resetToken: null,
                resetTokenExpires: null,
                refreshToken: null,
                refreshTokenExpires: null,
            }
        });

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
        // Accept from body (email/password login) or cookie (OAuth sessions).
        const refreshToken: string | undefined =
            req.body.refreshToken ?? req.cookies?.refreshToken;

        if(!refreshToken) {
            wideLogger.addCtx('refresh_token_result', 'missing_token');
            throw new AppError("Refresh token required!", 401, 'MISSING_TOKEN');
        };

        const payload = await verifyRefreshToken(refreshToken);

        const user = await prisma.user.findUnique({
            where: {
                id: payload.id,
                refreshTokenExpires: { gt: new Date() }
            }
        });

        if(!user || !user.refreshToken) {
            wideLogger.addCtx('refresh_token_result', 'invalid_user_or_expired');
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        };

        wideLogger.addCtx('user_id', user.id);
        const isMatch = await comparePasswords(refreshToken, user.refreshToken!);

        if(!isMatch) {
            wideLogger.addCtx('refresh_token_result', 'mismatch');
            throw new AppError("Invalid or expired refresh token!", 401, 'INVALID_TOKEN');
        };

        const newAccessToken = await generateAccessToken({
            id: user.id,
            email: user.email,
        });

        // Rotate the refresh token on every use: extends the 7-day window for
        // active users (instead of forcing a re-login exactly 7 days after the
        // original login) and invalidates the old token.
        const newRefreshToken = await generateRefreshToken({
            id: user.id,
            email: user.email,
        });

        const hashedRefreshToken = await hashPassword(newRefreshToken);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken: hashedRefreshToken,
                refreshTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            }
        });

        res.cookie('token', newAccessToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

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
                college: true,
                createdAt: true,
            },
        });

        const isNewUser = dbUser && (Date.now() - dbUser.createdAt.getTime()) < 120_000;
        if (isNewUser && dbUser) {
            const firstName = dbUser.fullName?.split(' ')[0] ?? dbUser.email.split('@')[0] ?? 'there';
            await emailService.sendWelcomeEmail({
                firstName,
                ...(dbUser.fullName ? { fullName: dbUser.fullName } : {}),
                email: dbUser.email,
                church: dbUser.college,
                signInUrl: `${frontendUrl}/onboarding/sign-in`,
            });
        }

        const accessToken = await generateAccessToken({
            id: user.id,
            email: user.email,
        });

        const refreshToken = await generateRefreshToken({
            id: user.id,
            email: user.email,
        });

        const hashedRefreshToken = await hashPassword(refreshToken);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken: hashedRefreshToken,
                refreshTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                lastLogin: new Date()
            }
        });

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: env.APP_STAGE === 'production',
            sameSite: 'strict',
            maxAge: 604800000 
        });

        wideLogger.addCtx('google_auth_result', 'success');
        return res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}`);
});

// Verify Email with OTP
export const verifyEmail = catchAsync(async(req: Request, res: Response ) => {
        const { otp, email } = req.body;

        if(!otp || typeof otp !== 'string') {
            wideLogger.addCtx('verify_email_result', 'fail');
            throw new AppError('Verification OTP is required!', 400, 'MISSING_OTP');
        };
        if(!email) {
            wideLogger.addCtx('verify_email_result', 'fail');
            throw new AppError('Verification email is required!', 400, 'MISSING_EMAIL');
        };

        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if(!user || !user.verifyToken) {
            wideLogger.addCtx('verify_email_result', 'fail');
            throw new AppError('User not found!', 404, 'USER_NOT_FOUND');
        }

        if(!user.verifyTokenExpires || user.verifyTokenExpires < new Date()) {
            wideLogger.addCtx('verify_email_result', 'fail');
            throw new AppError('Verification code has expired. Please request a new one.', 400, 'OTP_EXPIRED');
        }

        const isMatch = await comparePasswords(otp, user.verifyToken);

        if(!isMatch) {
            wideLogger.addCtx('verify_email_result', 'fail');
            throw new AppError('Invalid OTP, please enter the right OTP', 400, 'INVALID_OTP');
        };
        
        wideLogger.addCtx('user_id', user.id);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verifyToken: null,
                verifyTokenExpires: null
            }
        });

        await CacheService.delete(cacheKeys.userMe(user.id));

        wideLogger.addCtx('verify_email_result', 'success');
        return res.status(200).json({
            status: 'success',
            message: 'Email verified successfully! You can now log in.'
        });
});

export const resendVericationEmail = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
        wideLogger.addCtx('action', 'resend_verification_email');
        wideLogger.addCtx('user_id', req.user?.id);
        
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id }
        });

        if(!user) {
            wideLogger.addCtx('resend_verification_result', 'user_not_found');
            throw new AppError('User not found!', 404, 'USER_NOT_FOUND');
        };

        if(user.isVerified) {
            wideLogger.addCtx('resend_verification_result', 'already_verified');
            throw new AppError('User already verified!', 400, 'ALREADY_VERIFIED');
        };

        const otp = generateOTP();
        const hashedVerifyToken = await hashPassword(otp);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                verifyToken: hashedVerifyToken,
                verifyTokenExpires: new Date(Date.now() + 15 * 60 * 1000)
            }
        });

        await emailService.sendVerificationOTPEmail(user.email, otp, user.email.split('@')[0]);

        wideLogger.addCtx('resend_verification_result', 'success');
        return res.status(200).json({
            message: 'Verification OTP sent to your email!'
        });
});

// Logout
export const logoutUser = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'user_logout');
    if(req.user) {
        const userId = req.user?.id;
        wideLogger.addCtx('user_id', userId);

        await prisma.user.update({
        where: { id: userId },
        data: {
            refreshToken: null,
            refreshTokenExpires: null,
        }
        });
    };

    res.clearCookie('token', {
        httpOnly: true,
        secure: env.APP_STAGE === 'production',
        sameSite: 'strict',
    });

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.APP_STAGE === 'production',
        sameSite: 'strict',
    });

    wideLogger.addCtx('logout_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: "User logged out succesfully!",
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