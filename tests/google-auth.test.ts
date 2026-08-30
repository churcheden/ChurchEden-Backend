import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('Google OAuth HTTP flow (real passport strategy)', () => {
    it('GET /api/v1/auth/google/url returns the google authorization path', async () => {
        const res = await request(app).get('/api/v1/auth/google/url');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(typeof res.body.url).toBe('string');
        expect(res.body.url).toContain('/api/v1/auth/google');
        expect(res.body.url).toMatch(/^https?:\/\//);
    });

    it('GET /api/v1/auth/google redirects to Google accounts', async () => {
        const res = await request(app).get('/api/v1/auth/google');
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('accounts.google.com');
    });

    it('GET /api/v1/auth/google/callback without a code starts a fresh OAuth flow', async () => {
        const res = await request(app).get('/api/v1/auth/google/callback');
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('accounts.google.com');
    });

    it('GET /auth/google/callback alias behaves the same as the /api/v1 path', async () => {
        const res = await request(app).get('/auth/google/callback');
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('accounts.google.com');
    });
});