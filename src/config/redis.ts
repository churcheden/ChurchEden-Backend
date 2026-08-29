import { createClient } from "redis";
import { env } from '../env.js';

export type RedisClientType = ReturnType<typeof createClient>;

const envUrl = env.REDIS_URL;
let redisUrl = 'redis://localhost:6379';

if(envUrl &&  !envUrl.includes('placeholder')) {
    try{
        new URL(envUrl)
        redisUrl = envUrl;
    } catch{
        redisUrl = 'redis://localhost:6379'
    }
};

const isTls = redisUrl.startsWith('rediss://');

const config: Record<string, any> = { url: redisUrl};

if(isTls) {
    config.socket = { 
        tls: true as const, 
        rejectUnauthorized: env.NODE_ENV === 'production'
    }
};

const redisClient = createClient(config);

redisClient.on('error', (error) => {
    if(env.NODE_ENV != 'testing') {
        console.log("Redis client error: ", error)
    }
});

(async() => {
    try{
        if(env.NODE_ENV != 'testing'){
            await redisClient.connect();
            console.log("Redis connection successful!")
        }
    }catch(error) {
        console.log("Redis connection failed! :", error);
        process.exit(1);
    }
})();

export { redisClient };