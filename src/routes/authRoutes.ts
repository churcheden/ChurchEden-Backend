import { Router, type RequestHandler } from "express";
import { validateBody } from "../middleware/validation.middleware.js";
import {
    forgotPassword,
    getGoogleAuthUrl,
    googleCallback,
    loginUser,
    logoutUser,
    refreshToken,
    registerUser,
    resendVericationEmail,
    resetPassword,
    verifyEmail,
    getCurrentUser,
} from "../controllers/authController.js";
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
} from '../schema/auth.schema.js';
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authLimitter, passwordLimitter } from "../middleware/rateLimiter.middleware.js";
import { passport } from '../config/passport.js';
import { env } from '../env.js';

const router = Router();

// Manual auth
router.post('/register', authLimitter, validateBody(registerSchema), registerUser);
router.post('/login', authLimitter, validateBody(loginSchema), loginUser);
router.post('/logout', authenticateToken as RequestHandler, logoutUser as RequestHandler);
router.get('/me', authenticateToken as RequestHandler, getCurrentUser as RequestHandler);
router.post('/refresh', validateBody(refreshTokenSchema), refreshToken);
router.post('/forgot-password', passwordLimitter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordLimitter, validateBody(resetPasswordSchema), resetPassword);
router.post('/verify-email', authLimitter, validateBody(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', authLimitter, authenticateToken as RequestHandler, resendVericationEmail as RequestHandler);

// Google OAuth
router.get('/google/url', getGoogleAuthUrl);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback',
    (req, res, next) => {
        const frontendUrl = env.FRONTEND_URL;
        passport.authenticate('google', {
            session: false,
            failureRedirect: `${frontendUrl}/sign-in?error=auth_failed`,
        })(req, res, next);
    },
    googleCallback as RequestHandler
);

export default router;
