import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/env.js';
import { AppError } from '../src/utils/AppError.js';
import { errorHandler } from '../src/middleware/errorHandler.middleware.js';

describe('health & cross-cutting concerns', () => {
    it('GET /health returns OK with an ISO date', async () => {
        const before = new Date();
        const res = await request(app).get('/health');
        const after = new Date();
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(res.body.service).toBe('ChurchEden Backend API');
        expect(new Date(res.body.date).getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(new Date(res.body.date).getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('CORS allows the configured frontend origin', async () => {
        const res = await request(app)
            .options('/api/v1/auth/login')
            .set('Origin', env.FRONTEND_URL)
            .set('Access-Control-Request-Method', 'POST');
        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS echoes the configured origin unconditionally (single fixed origin, not reflected)', async () => {
        const res = await request(app)
            .options('/api/v1/auth/login')
            .set('Origin', 'https://evil.example.com')
            .set('Access-Control-Request-Method', 'POST');
        expect(res.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('unknown routes return the 404 PageNotFound shape', async () => {
        const res = await request(app).get('/api/v1/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({
            status: 'error',
            code: 'PageNotFound',
            message: `Cannot find /api/v1/does-not-exist on the server!`,
        });
    });

    it('the /auth alias behaves like /api/v1/auth', async () => {
        const body = { email: 'unknown@user.com', password: 'wrong-password' };
        const viaAlias = await request(app).post('/auth/login').send(body);
        const viaFull = await request(app).post('/api/v1/auth/login').send(body);
        expect(viaAlias.status).toBe(401);
        expect(viaFull.status).toBe(401);
        expect(viaAlias.body).toEqual(viaFull.body);
        expect(viaAlias.body.code).toBe('UNAUTHORIZED');
    });

    it('payment routes are reachable via /api/v1 alias (duplicate mount)', async () => {
        const viaAlias = await request(app).get('/api/v1/initialize');
        const viaFull = await request(app).get('/api/v1/payments/initialize');
        expect(viaAlias.status).toBe(401);
        expect(viaFull.status).toBe(401);
        expect(viaAlias.body.code).toBe('MISSING_TOKEN');
        expect(viaFull.body.code).toBe('MISSING_TOKEN');
    });
});

describe('errorHandler', () => {
    const makeRes = () => ({
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    });

    const call = (err: unknown) => {
        const res = makeRes();
        errorHandler(err as Error, {} as never, res as never, () => undefined);
        return res;
    };

    it('maps an AppError to its status, code and message', () => {
        const res = call(new AppError('Cannot find /nope on the server!', 404, 'PageNotFound'));
        expect(res.status).toHaveBeenCalledWith(404);
        const body = res.json.mock.calls[0][0];
        expect(body).toEqual({
            status: 'error',
            code: 'PageNotFound',
            message: 'Cannot find /nope on the server!',
        });
    });

    it('maps a Prisma P2002 conflict to 409', () => {
        const res = call(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json.mock.calls[0][0]).toEqual({
            status: 'error',
            message: 'A record with this value already exists!',
        });
    });

    it('maps an unknown error to a 500 fail shape with details in non-production', () => {
        const err = new Error('boom');
        const res = call(err);
        expect(res.status).toHaveBeenCalledWith(500);
        const body = res.json.mock.calls[0][0];
        expect(body.status).toBe('fail');
        expect(body.error).toBe('Internal Server Error');
        expect(body.message).toBe('boom');
        expect(body.stack).toBe(err.stack);
    });
});