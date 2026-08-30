import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { fakeRedis, emailServiceMock } from './helpers/fakes.js';
import { extractLastOtp } from './helpers/auth.js';

describe('smoke', () => {
    it('health returns 200 without being rate limited', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
    });

    it('register flows through the email mock into in-memory redis', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'smoke@test.com', password: 'StrongPass123!' })
            .expect(201);
        expect(res.body.requiresVerification).toBe(true);
        const otp = extractLastOtp('smoke@test.com');
        expect(otp).toMatch(/^\d{6}$/);
        expect(fakeRedis.keys().some((key) => key.startsWith('pending-registration:'))).toBe(true);

        const verify = await request(app)
            .post('/api/v1/auth/verify-email')
            .send({ email: 'smoke@test.com', otp })
            .expect(200);
        expect(verify.body.accessToken).toBeTruthy();
        expect(emailServiceMock.sendWelcomeEmail).toHaveBeenCalled();
    });
});