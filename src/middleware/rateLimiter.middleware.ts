import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis.js';

const buildRedisStore = (prefix: string) => new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix,
});

const createLimiter = (options: {
    prefix: string;
    windowMs: number;
    max: number;
    message: string;
    skipSuccessfulRequests?: boolean;
}) => rateLimit({
    store: buildRedisStore(options.prefix),
    windowMs: options.windowMs,
    max: options.max,
    message: {
        status: 'error',
        message: options.message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
});

export const apiLimitter = createLimiter({
    prefix: 'rl:api:',
    windowMs: 15 * 60 * 1000,
    max: 5000,
    message: 'Too many requests on this IP, please try again later',
});

export const authLimitter = createLimiter({
    prefix: 'rl:auth:',
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again after an hour',
    skipSuccessfulRequests: true,
});

export const passwordLimitter = createLimiter({
    prefix: 'rl:password:',
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset attempts, please try again after an hour',
});

export const resendVerificationLimitter = rateLimit({
    store: buildRedisStore('rl:resend-verify:'),
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: {
        status: 'error',
        message: 'Too many verification OTP resends, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = (req.body as { email?: string } | undefined)?.email?.trim().toLowerCase();
        return email ? `email:${email}` : ipKeyGenerator(req.ip as string);
    },
});

export const churchRequestLimiter = createLimiter({
    prefix: 'rl:church-request:',
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many church registration requests, please try again later',
});

