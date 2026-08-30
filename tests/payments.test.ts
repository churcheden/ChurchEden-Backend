import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/env.js';
import { emailServiceMock, resetFakes } from './helpers/fakes.js';
import { authHeader, registerAndVerify } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const until = async (
    predicate: () => Promise<boolean> | boolean,
    timeout = 8000,
): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await predicate()) return;
        await sleep(50);
    }
    throw new Error('condition not met in time');
};

const webhookPost = (payload: unknown, signature?: string) => {
    const raw = Buffer.from(JSON.stringify(payload));
    const sig =
        signature ??
        createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
    return request(app)
        .post('/api/v1/webhooks/paystack')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', sig)
        .send(raw.toString('utf8'));
};

const chargeEvent = (reference: string, userId: string, overrides: Record<string, unknown> = {}) => ({
    event: 'charge.success',
    data: {
        amount: 20000,
        currency: 'GHS',
        reference,
        paid_at: new Date().toISOString(),
        metadata: { userId },
        customer: { email: 'member@test.com' },
        ...overrides,
    },
});

describe('payments', () => {
    let user: Awaited<ReturnType<typeof registerAndVerify>>;
    const mockFetch = vi.fn();

    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
        user = await registerAndVerify();
        mockFetch.mockReset();
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const paystackOk = (payload: unknown) => ({ json: async () => payload });

    describe('GET /api/v1/payments/initialize', () => {
        it('401 — MISSING_TOKEN without a token', async () => {
            const res = await request(app).get('/api/v1/payments/initialize');
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('MISSING_TOKEN');
        });

        it('404 — USER_NOT_FOUND for a deleted user', async () => {
            await prisma.user.delete({ where: { id: user.userId } });
            const res = await request(app)
                .get('/api/v1/payments/initialize')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('USER_NOT_FOUND');
        });

        it('409 — ALREADY_PREMIUM when the user is already premium', async () => {
            await prisma.user.update({ where: { id: user.userId }, data: { isPremium: true } });
            const res = await request(app)
                .get('/api/v1/payments/initialize')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ALREADY_PREMIUM');
        });

        it('200 — creates a pending transaction and returns the Paystack authorization URL', async () => {
            mockFetch.mockResolvedValue(
                paystackOk({
                    status: true,
                    message: 'OK',
                    data: {
                        authorization_url: 'https://checkout.paystack.com/test',
                        reference: 'REF-INIT-1',
                        access_code: 'ac_1',
                    },
                }),
            );

            const res = await request(app)
                .get('/api/v1/payments/initialize')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.data.authorizationUrl).toBe('https://checkout.paystack.com/test');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://api.paystack.co/transaction/initialize');
            const sent = JSON.parse(init.body as string);
            expect(sent.metadata).toEqual({ userId: user.userId });
            expect(sent.currency).toBe('GHS');
            expect(sent.plan).toBe(env.PAYSTACK_PLAN_CODE);
            expect(sent.callback_url).toBe(`${env.FRONTEND_URL}/payment/verify`);

            const transaction = await prisma.transaction.findUnique({ where: { reference: 'REF-INIT-1' } });
            expect(transaction?.status).toBe('pending');
            expect(transaction?.authorizationUrl).toBe('https://checkout.paystack.com/test');
            expect(transaction?.amount.toString()).toBe('20000');
        });

        it('200 — reuses an unresolved pending transaction within 30 minutes', async () => {
            mockFetch.mockResolvedValue(
                paystackOk({
                    status: true,
                    message: 'OK',
                    data: {
                        authorization_url: 'https://checkout.paystack.com/test',
                        reference: 'REF-INIT-1',
                        access_code: 'ac_1',
                    },
                }),
            );
            await request(app)
                .get('/api/v1/payments/initialize')
                .set(authHeader(user.accessToken))
                .expect(200);

            await request(app)
                .get('/api/v1/payments/initialize')
                .set(authHeader(user.accessToken))
                .expect(200);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(await prisma.transaction.count()).toBe(1);
        });

        it('400 — PAYSTACK_ERROR when Paystack declines the request', async () => {
            mockFetch.mockResolvedValue(paystackOk({ status: false, message: 'Invalid plan' }));
            const res = await request(app)
                .get('/api/v1/payments/initialize')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PAYSTACK_ERROR');
            expect(await prisma.transaction.count()).toBe(0);
        });
    });

    describe('GET /api/v1/payments/initialize/verify/:reference', () => {
        const verifyOk = () => ({
            status: true,
            message: 'Verification successful',
            data: {
                status: 'success',
                reference: 'REF-VERIFY-1',
                amount: '20000',
                currency: 'GHS',
                paid_at: '2026-08-01T10:00:00.000Z',
                metadata: { userId: user.userId },
                customer: { email: user.email },
            },
        });

        it('401 — MISSING_TOKEN without a token', async () => {
            const res = await request(app).get('/api/v1/payments/initialize/verify/REF-VERIFY-1');
            expect(res.status).toBe(401);
        });

        it('400 — PAYSTACK_ERROR when Paystack returns status false', async () => {
            mockFetch.mockResolvedValue(paystackOk({ status: false, message: 'Invalid reference' }));
            const res = await request(app)
                .get('/api/v1/payments/initialize/verify/REF-VERIFY-1')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PAYSTACK_ERROR');
        });

        it('400 — PAYMENT_FAILED when the Paystack status is not success', async () => {
            mockFetch.mockResolvedValue(
                paystackOk({
                    status: true,
                    message: 'OK',
                    data: { status: 'failed', metadata: { userId: user.userId } },
                }),
            );
            const res = await request(app)
                .get('/api/v1/payments/initialize/verify/REF-VERIFY-1')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PAYMENT_FAILED');
        });

        it('404 — TRANSACTION_NOT_FOUND when no matching row exists', async () => {
            mockFetch.mockResolvedValue(paystackOk(verifyOk()));
            const res = await request(app)
                .get('/api/v1/payments/initialize/verify/REF-VERIFY-1')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('TRANSACTION_NOT_FOUND');
        });

        it('200 — upgrades the user to premium and marks the transaction paid', async () => {
            await prisma.transaction.create({
                data: {
                    userId: user.userId,
                    reference: 'REF-VERIFY-1',
                    amount: '20000',
                    status: 'pending',
                    authorizationUrl: 'https://checkout.paystack.com/test',
                },
            });
            mockFetch.mockResolvedValue(paystackOk(verifyOk()));

            const res = await request(app)
                .get('/api/v1/payments/initialize/verify/REF-VERIFY-1')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.data.result.isPremium).toBe(true);

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.isPremium).toBe(true);
            const expiryMs = dbUser!.premiumExpiry!.getTime() - Date.now();
            expect(expiryMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);

            const transaction = await prisma.transaction.findUnique({ where: { reference: 'REF-VERIFY-1' } });
            expect(transaction?.status).toBe('success');
        });
    });

    describe('GET /api/v1/payments/subscription/cancel', () => {
        it('404 — NO_SUBSCRIPTION when the user has no subscription reference', async () => {
            const res = await request(app)
                .get('/api/v1/payments/subscription/cancel')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('NO_SUBSCRIPTION');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('200 — disables the Paystack subscription and cancels premium locally', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: {
                    subscriptionRef: 'SUB_123',
                    subscriptionProcessor: 'paystack',
                    subscriptionStatus: 'ACTIVE',
                    isPremium: true,
                },
            });
            mockFetch.mockResolvedValue(paystackOk({ status: true, message: 'Subscription disabled' }));

            const res = await request(app)
                .get('/api/v1/payments/subscription/cancel')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.data.result.isPremium).toBe(false);

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://api.paystack.co/subscription/disable');
            expect(JSON.parse(init.body as string).code).toBe('SUB_123');

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.subscriptionStatus).toBe('CANCELED');
            expect(dbUser?.isPremium).toBe(false);
        });

        it('400 — PAYSTACK_ERROR when Paystack fails', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { subscriptionRef: 'SUB_123', subscriptionProcessor: 'paystack' },
            });
            mockFetch.mockResolvedValue(paystackOk({ status: false, message: 'boom' }));
            const res = await request(app)
                .get('/api/v1/payments/subscription/cancel')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PAYSTACK_ERROR');
        });
    });

    describe('POST /api/v1/webhooks/paystack', () => {
        it('401 — rejects an unsigned webhook', async () => {
            const res = await webhookPost(chargeEvent('REF-W-1', user.userId), 'deadbeef');
            expect(res.status).toBe(401);
            expect(res.body.status).toBe('fail');
            expect(emailServiceMock.sendPaymentEmail).not.toHaveBeenCalled();
        });

        it('200 — charge.success activates premium, marks the transaction paid and emails once', async () => {
            await prisma.transaction.create({
                data: {
                    userId: user.userId,
                    reference: 'REF-W-1',
                    amount: '20000',
                    status: 'pending',
                    authorizationUrl: 'https://checkout.paystack.com/test',
                },
            });
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;

            const res = await webhookPost(chargeEvent('REF-W-1', user.userId));
            expect(res.status).toBe(200);
            await until(async () => {
                const transaction = await prisma.transaction.findUnique({ where: { reference: 'REF-W-1' } });
                return transaction?.status === 'success';
            });
            await until(() => emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore >= 1);

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.isPremium).toBe(true);
            expect(dbUser?.premiumExpiry!.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);

            const replayed = await webhookPost(chargeEvent('REF-W-1', user.userId));
            expect(replayed.status).toBe(200);
            await sleep(400);
            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);
        });

        it('200 — charge.success with an unknown reference does not email', async () => {
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;
            const res = await webhookPost(chargeEvent('REF-W-UNKNOWN', user.userId));
            expect(res.status).toBe(200);
            await sleep(500);
            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(0);
        });

        it('200 — charge.failed marks the pending transaction failed and emails', async () => {
            await prisma.transaction.create({
                data: {
                    userId: user.userId,
                    reference: 'REF-W-FAIL',
                    amount: '20000',
                    status: 'pending',
                    authorizationUrl: 'https://checkout.paystack.com/test',
                },
            });
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;

            const res = await webhookPost({
                event: 'charge.failed',
                data: { reference: 'REF-W-FAIL', metadata: { userId: user.userId } },
            });
            expect(res.status).toBe(200);
            await until(async () => {
                const transaction = await prisma.transaction.findUnique({ where: { reference: 'REF-W-FAIL' } });
                return transaction?.status === 'failed';
            });
            await until(() => emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore >= 1);

            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);
        });

        it('200 — subscription.create stores the subscription code and emails', async () => {
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;
            const res = await webhookPost({
                event: 'subscription.create',
                data: {
                    metadata: { userId: user.userId },
                    customer: { email: user.email },
                    subscription: {
                        subscription_code: 'SUB_CREATE_1',
                        email_token: 'token-1',
                        status: 'active',
                        next_payment_date: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
                    },
                },
            });
            expect(res.status).toBe(200);
            await until(async () => {
                const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
                return dbUser?.subscriptionRef === 'SUB_CREATE_1';
            });

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.subscriptionStatus).toBe('ACTIVE');
            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);
        });

        it('200 — subscription.disable cancels premium and emails', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { isPremium: true, subscriptionStatus: 'ACTIVE' },
            });
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;
            const res = await webhookPost({
                event: 'subscription.disable',
                data: { metadata: { userId: user.userId }, customer: { email: user.email } },
            });
            expect(res.status).toBe(200);
            await until(async () => {
                const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
                return dbUser?.subscriptionStatus === 'CANCELED';
            });

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.isPremium).toBe(false);
            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);
        });

        it('200 — invoice.update extends the premium expiry and emails', async () => {
            await prisma.user.update({
                where: { id: user.userId },
                data: { isPremium: true, premiumExpiry: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) },
            });
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;
            const res = await webhookPost({
                event: 'invoice.update',
                data: {
                    status: 'success',
                    metadata: { userId: user.userId },
                    customer: { email: user.email },
                    subscription: { next_payment_date: new Date().toISOString() },
                },
            });
            expect(res.status).toBe(200);
            await until(async () => {
                const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
                return (dbUser?.premiumExpiry?.getTime() ?? 0) > Date.now() + 29 * 24 * 60 * 60 * 1000;
            });

            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);
        });

        it('200 — invoice.payment_failed sets a 3-day grace period and emails', async () => {
            const emailBefore = emailServiceMock.sendPaymentEmail.mock.calls.length;
            const res = await webhookPost({
                event: 'invoice.payment_failed',
                data: { metadata: { userId: user.userId }, customer: { email: user.email } },
            });
            expect(res.status).toBe(200);
            await until(() => emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore >= 1);

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            const graceMs = dbUser!.premiumExpiry!.getTime() - Date.now();
            expect(graceMs).toBeGreaterThan(2 * 24 * 60 * 60 * 1000);
            expect(graceMs).toBeLessThan(4 * 24 * 60 * 60 * 1000);
            expect(emailServiceMock.sendPaymentEmail.mock.calls.length - emailBefore).toBe(1);
        });
    });
});