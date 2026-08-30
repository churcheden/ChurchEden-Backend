import { vi } from 'vitest';

/**
 * Concrete fakes for the external services the backend talks to.
 *
 * - FakeRedisClient   : in-memory stand-in for `node-redis` (cache + draft storage)
 * - FakeRedisStore    : in-memory stand-in for `rate-limit-redis` v4 stores
 * - EmailServiceMock  : replaces src/services/email.service.js so no Resend call is ever made
 *
 * All instances are created once (module load) and registered so tests can
 * inspect/reset them deterministically.
 */
const fakes = vi.hoisted(() => {
    interface CachedEntry {
        value: string;
        expiresAt: number;
    }

    class FakeRedisClient {
        private store = new Map<string, CachedEntry>();

        async setEx(key: string, ttlSeconds: number, value: string): Promise<string> {
            this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
            return 'OK';
        }

        async get(key: string): Promise<string | null> {
            const entry = this.store.get(key);
            if (!entry) return null;
            if (entry.expiresAt <= Date.now()) {
                this.store.delete(key);
                return null;
            }
            return entry.value;
        }

        async del(key: string): Promise<number> {
            return this.store.delete(key) ? 1 : 0;
        }

        async ttl(key: string): Promise<number> {
            const entry = this.store.get(key);
            if (!entry) return -2;
            const seconds = Math.ceil((entry.expiresAt - Date.now()) / 1000);
            return seconds > 0 ? seconds : -2;
        }

        scanIterator(options: { MATCH?: string; COUNT?: number }): AsyncIterable<string[]> {
            const pattern = options.MATCH ?? '*';
            const count = options.COUNT ?? 200;
            const self = this;
            return {
                async *[Symbol.asyncIterator]() {
                    const keys = [...self.store.keys()].filter((key) => matchesGlob(key, pattern));
                    for (let i = 0; i < keys.length; i += count) {
                        yield keys.slice(i, i + count);
                    }
                },
            };
        }

        has(key: string): boolean {
            return this.store.has(key);
        }

        keys(): string[] {
            return [...this.store.keys()];
        }

        clear(): void {
            this.store.clear();
        }
    }

    class FakeRedisStore {
        localKeys = true;
        prefix: string;
        private hits = new Map<string, number>();
        private resetTimes = new Map<string, Date>();

        constructor(options: { prefix?: string; sendCommand?: (...args: string[]) => unknown } = {}) {
            this.prefix = options.prefix ?? 'rl:';
            rateLimitStores.add(this);
        }

        async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
            const fullKey = this.prefix + key;
            const existing = this.resetTimes.get(fullKey);
            const now = Date.now();
            if (!existing || existing.getTime() <= now) {
                this.hits.set(fullKey, 1);
                this.resetTimes.set(fullKey, new Date(now + 60 * 60 * 1000));
            } else {
                this.hits.set(fullKey, (this.hits.get(fullKey) ?? 0) + 1);
            }
            return {
                totalHits: this.hits.get(fullKey) ?? 1,
                resetTime: this.resetTimes.get(fullKey) as Date,
            };
        }

        async decrement(key: string): Promise<void> {
            const fullKey = this.prefix + key;
            const current = this.hits.get(fullKey) ?? 0;
            if (current <= 1) {
                this.hits.delete(fullKey);
                this.resetTimes.delete(fullKey);
            } else {
                this.hits.set(fullKey, current - 1);
            }
        }

        async resetKey(key: string): Promise<void> {
            const fullKey = this.prefix + key;
            this.hits.delete(fullKey);
            this.resetTimes.delete(fullKey);
        }

        reset(): void {
            this.hits.clear();
            this.resetTimes.clear();
        }
    }

    class EmailServiceMock {
        sendVerificationOTPEmail = vi.fn().mockResolvedValue(true);
        sendWelcomeEmail = vi.fn().mockResolvedValue(true);
        sendPasswordResetEmail = vi.fn().mockResolvedValue(true);
        sendPasswordChangeEmail = vi.fn().mockResolvedValue(true);
        sendDeletionEmail = vi.fn().mockResolvedValue(true);
        sendPaymentEmail = vi.fn().mockResolvedValue(true);
        sendRegistrationEmails = vi.fn().mockResolvedValue({ otpSent: true, welcomeSent: true });

        reset(): void {
            for (const value of Object.values(this)) {
                if (
                    typeof value === 'function' &&
                    typeof (value as { mockClear?: () => void }).mockClear === 'function'
                ) {
                    (value as { mockClear: () => void }).mockClear();
                }
            }
        }
    }

    const matchesGlob = (key: string, pattern: string): boolean => {
        if (!pattern.includes('*')) return key === pattern;
        const escaped = pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`^${escaped.join('.*')}$`);
        return regex.test(key);
    };

    const rateLimitStores: Set<FakeRedisStore> = new Set();
    const fakeRedis = new FakeRedisClient();
    const emailServiceMock = new EmailServiceMock();

    return {
        FakeRedisClient,
        FakeRedisStore,
        EmailServiceMock,
        fakeRedis,
        rateLimitStores,
        emailServiceMock,
    };
});

export const FakeRedisClient = fakes.FakeRedisClient;
export const FakeRedisStore = fakes.FakeRedisStore;
export const fakeRedis = fakes.fakeRedis;
export const emailServiceMock = fakes.emailServiceMock;

/** Clears in-memory Redis + every rate-limit store + email call history. */
export const resetFakes = (): void => {
    fakes.fakeRedis.clear();
    for (const store of fakes.rateLimitStores) store.reset();
    fakes.emailServiceMock.reset();
};