import rateLimit from 'express-rate-limit';
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
