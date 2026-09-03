import { z } from 'zod';

export const registerSchema = z.object({
    email: z.email("Invalid email address"),
    password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1, "Password is required!"),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(32, "Token must be at least 32 characters").optional()
})

export const forgotPasswordSchema = z.object({
    email: z.email('Invalid email adress!'),
});

export const resetPasswordSchema = z.object({
    token: z.string(),
    newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export const verifyEmailSchema = z.object({
    email: z.email("Invalid email address!"),
    otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits")
});

export const resendVerificationSchema = z.object({
    email: z.email("Invalid email address!"),
});

export const googleTokenSchema = z.object({
    idToken: z.string().min(1, 'Google ID token is required.'),
    platform: z.enum(['android', 'ios', 'web', 'expo']).default('web'),
    // Which identity table to authenticate against. Defaults to MEMBER; pass
    // 'ADMIN' when the mobile app is signing in an admin account.
    accountType: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    // Required for MEMBER account creation via Google — the Member model
    // requires a churchId. Ignored for ADMIN accounts.
    churchId: z.uuid('Invalid church id').optional(),
});
