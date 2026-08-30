import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        env: {
            NODE_ENV: 'testing',
        },
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.ts'],
        pool: 'forks',
        fileParallelism: false,
        sequence: {
            concurrent: false,
        },
        testTimeout: 20000,
        hookTimeout: 30000,
        teardownTimeout: 30000,
    },
});