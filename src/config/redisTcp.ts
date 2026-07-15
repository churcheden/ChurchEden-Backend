import { Redis } from "ioredis";
import { env } from '../env.js';

const redisTcp = new Redis(env.REDIS_TCP_URL, {
    maxRetriesPerRequest: null,
});

export {redisTcp};