import { Router, type RequestHandler } from "express";
import { validateBody } from "../middleware/validation.middleware.js";
import { buildOAuthState, parseOAuthState } from "../utils/oauthState.js";
import {
    forgotPassword,
    getGoogleAuthUrl,
    googleCallback,
    loginUser,
    logoutUser,
    refreshToken,
    registerUser,
    resendVerificationEmail,
    resetPassword,
    verifyEmail,
    getCurrentUser,
    exchangeGoogleToken,
} from "../controllers/authController.js";
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    resendVerificationSchema,
    googleTokenSchema,
} from '../schema/auth.schema.js';
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authLimitter, passwordLimitter, resendVerificationLimitter } from "../middleware/rateLimiter.middleware.js";
import { passport } from '../config/passport.js';
import { env } from '../env.js';

const router = Router();

// Manual auth
router.post('/register', authLimitter, validateBody(registerSchema), registerUser);
router.post('/login', authLimitter, validateBody(loginSchema), loginUser);
router.post('/logout', logoutUser as RequestHandler);
router.get('/me', authenticateToken as RequestHandler, getCurrentUser as RequestHandler);
router.post('/refresh', validateBody(refreshTokenSchema), refreshToken);
router.post('/forgot-password', passwordLimitter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordLimitter, validateBody(resetPasswordSchema), resetPassword);
router.post('/verify-email', authLimitter, validateBody(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', resendVerificationLimitter, validateBody(resendVerificationSchema), resendVerificationEmail);

// Google OAuth
router.get('/google/url', getGoogleAuthUrl);
router.post('/google/token', validateBody(googleTokenSchema), exchangeGoogleToken);
router.get('/google', (req, res, next) => {
    const platform = (req.query.platform as string) || 'web';
    const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : '';
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
        state: buildOAuthState(platform, redirect),
    })(req, res, next);
});
router.get('/google/callback',
    (req, res, next) => {
        const { platform, redirect } = parseOAuthState((req.query.state as string) || '');
        const failureRedirect = platform === 'mobile'
            ? `${redirect || 'churcheden://auth/callback'}?error=auth_failed`
            : `${env.FRONTEND_URL}/onboarding/sign-in?error=auth_failed`;

        // Use the callback form of passport.authenticate so that OAuth token
        // errors (e.g. TokenError: Bad Request when Google rejects the code
        // exchange) are caught here and redirected to the failure URL instead
        // of falling through to the global JSON error handler and showing raw
        // JSON in the user's browser.
        passport.authenticate('google', { session: false }, (err: Error | null, user: Express.User | false) => {
            if (err || !user) {
                return res.redirect(failureRedirect);
            }
            // Attach user so googleCallback can read req.user.
            // Cast through unknown first — Request and the index-signature type
            // don't structurally overlap, so a direct cast is rejected by TS.
            (req as unknown as { user: Express.User }).user = user;
            next();
        })(req, res, next);
    },
    googleCallback as RequestHandler
);

export default router;
