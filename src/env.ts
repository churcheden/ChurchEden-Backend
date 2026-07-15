import { env as loadEnv } from 'custom-env';
import { z, ZodError } from 'zod';

// SETTING STAGE
process.env.APP_STAGE = process.env.APP_STAGE || 'dev';

// STAGE FLAGING
const isDevelopment = process.env.APP_STAGE === 'dev';
const isTesting = process.env.APP_STAGE === 'test';

// LOADING THE APPROPRAITE ENV FILE
if(isDevelopment){
    loadEnv();
}else if (isTesting){
    loadEnv('test');
};

// ENV SCHEMA DEFINTION
const envSchema = z.object({
    NODE_ENV: z.
    enum(['production', 'development', 'testing'])
    .default('development'),

    APP_STAGE: z.
    enum(['production', 'dev', 'test'])
    .default('dev'),

    NPM_PACKAGE_VERSION: z.string().default(process.env.npm_package_version ?? 'Unknown'),

    PORT: z.coerce.number().positive().default(3000),

    DATABASE_URL: z.string().startsWith('postgresql://'),

    BCRYPT_ROUNDS: z.coerce.number().min(10).max(20).default(12),

    REDIS_URL: z.string(),

    REDIS_TCP_URL: z.string(),

    RESEND_API_KEY: z.string(),

    EMAIL_FROM: z.string(),

    FRONTEND_URL: z.string(),

    ACCESS_TOKEN_SECRET: z.string().min(32, 'Access token should be at least 32 chareacters'),
    
    REFRESH_TOKEN_SECRET: z.string().min(32, 'Refresh token should be at least 32 chareacters'),

    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),

    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

    GOOGLE_CLIENT_ID: z.string(),

    GOOGLE_CLIENT_SECRET: z.string(),

    GOOGLE_CALLBACK_URL: z.string(),

    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string(),

    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string(),

    CLOUDFLARE_R2_ENDPOINT: z.string(),

    CLOUDFLARE_R2_BUCKET_NAME: z.string(),

    CLOUDFLARE_R2_PUBLIC_URL: z.string(),

    PAYSTACK_SECRET_KEY: z.string(),

    SUBSCRIPTION_AMOUNT_KOBO: z.string().default('2000'),

    PAYSTACK_PLAN_CODE: z.string().startsWith('PLN_'),

    GEMINI_API_KEY: z.string(),
});

// IMPORT SCHEMA
export type Env = z.infer<typeof envSchema>;

let env: Env;

try{
    env = envSchema.parse(process.env);
}catch(e){
    if(e instanceof ZodError){
        console.log('Invalid env var');
        console.error(e.flatten().fieldErrors, null, 2);

        e.issues.forEach((err)=> {
            const path = err.path.join('.')
            console.log(`${path}: ${err.message}`)
        });
        process.exit(1);
    }
    throw e;
};

export { env };
