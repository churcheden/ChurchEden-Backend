import { vi } from 'vitest';

// In-memory Redis replaces `node-redis` so no external cache is needed at all.
vi.mock('../src/config/redis.js', () =>
    import('./helpers/fakes.js').then((m) => ({ redisClient: m.fakeRedis })),
);

// rate-limit stores run in-memory and are reset per test.
vi.mock('rate-limit-redis', () =>
    import('./helpers/fakes.js').then((m) => ({ default: m.FakeRedisStore })),
);

// Every email goes through the deterministically controllable mock.
vi.mock('../src/services/email.service.js', () =>
    import('./helpers/fakes.js').then((m) => ({ emailService: m.emailServiceMock })),
);