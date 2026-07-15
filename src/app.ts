import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import passport from 'passport';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { apiLimitter } from './middleware/rateLimiter.middleware.js';
import './config/passport.js';
import { env } from './env.js';
import { AppError } from './utils/AppError.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { wideLoggerMiddleware } from './middleware/wideLogger.middleware.js';

const app = express();

app.set('trust proxy', 1);

const corsOptions: cors.CorsOptions = {
    origin: env.FRONTEND_URL || 'https://churcheden.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-client-platform'],
};
app.use(cors(corsOptions));

app.use('/api/v1/webhooks/paystack', express.raw({ type: 'application/json' }));
app.use('/api/v1', paymentRoutes);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(compression());
app.use(cookieParser());

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    hsts: {
        maxAge:31536000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use(passport.initialize());
app.use(apiLimitter);
app.use(wideLoggerMiddleware);

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        date: new Date().toISOString(),
        service: 'ChurchEden Backend API'
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/upload', uploadRoutes);

app.all(/.*/, (req, _res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on the server!`, 404, 'PageNotFound'));
});

app.use(errorHandler);

export { app };
