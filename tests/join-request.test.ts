import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { cacheKeys, CacheService } from '../src/utils/cache.js';
import { fakeRedis, resetFakes } from './helpers/fakes.js';
import { authHeader, registerAndVerify } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const createChurch = async (name: string, adminUserId: string) => {
    const church = await prisma.church.create({
        data: {
            name,
            denomination: 'Pentecostal',
            congregationSize: 'RANGE_101_500',
            country: 'NG',
            city: 'Lagos',
            address: '12 Broad Street',
            phone: '+2348012345678',
            email: `${randomUUID()}@church.test`,
            primaryLanguage: 'ENGLISH',
            timeZone: 'Africa/Lagos',
        },
    });
    await prisma.churchMembership.create({
        data: {
            userId: adminUserId,
            churchId: church.id,
            role: 'SUPER_ADMIN',
            status: 'APPROVED',
        },
    });
    return church;
};

describe('join-requests', () => {
    let admin: Awaited<ReturnType<typeof registerAndVerify>>;
    let applicant: Awaited<ReturnType<typeof registerAndVerify>>;
    let church: Awaited<ReturnType<typeof createChurch>>;
    let churchOther: Awaited<ReturnType<typeof createChurch>>;

    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
        admin = await registerAndVerify();
        applicant = await registerAndVerify();
        church = await createChurch('Grace Assembly', admin.userId);
        churchOther = await createChurch('Riverside', admin.userId);
    });

    describe('POST /api/v1/join-requests', () => {
        it('401 — MISSING_TOKEN without a token', async () => {
            const res = await request(app)
                .post('/api/v1/join-requests')
                .send({ churchId: church.id });
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('MISSING_TOKEN');
        });

        it('400 — VALIDATION_FAILED for a non-uuid church id', async () => {
            const res = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: 'not-a-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('404 — CHURCH_NOT_FOUND for an unknown church', async () => {
            const res = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: '99999999-9999-4999-9999-999999999999' });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('CHURCH_NOT_FOUND');
        });

        it('201 — creates a PENDING membership and clears the /me cache', async () => {
            await request(app)
                .get('/api/v1/auth/me')
                .set(authHeader(applicant.accessToken))
                .expect(200);
            expect(fakeRedis.has(cacheKeys.userMe(applicant.userId))).toBe(true);

            const res = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id });
            expect(res.status).toBe(201);
            expect(res.body.membership.status).toBe('PENDING');
            expect(res.body.membership.role).toBe('MEMBER');
            expect(res.body.membership.church.name).toBe('Grace Assembly');
            expect(fakeRedis.has(cacheKeys.userMe(applicant.userId))).toBe(false);
        });

        it('409 — ALREADY_PENDING when a request already exists', async () => {
            await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id });
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ALREADY_PENDING');
        });

        it('409 — ALREADY_MEMBER once approved', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id })
                .expect(200);

            const res = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id });
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ALREADY_MEMBER');
        });

        it('200 — a REJECTED member can re-apply and the row goes back to PENDING', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            const membershipId = submit.body.membership.id;

            await request(app)
                .post('/api/v1/join-requests/reject')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, rejectionReason: 'No follow-up' })
                .expect(200);

            const resubmit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id });
            expect(resubmit.status).toBe(200);
            expect(resubmit.body.membership.status).toBe('PENDING');
            expect(resubmit.body.membership.rejectionReason).toBeNull();

            const row = await prisma.churchMembership.findUnique({ where: { id: membershipId } });
            expect(row?.status).toBe('PENDING');
            expect(row?.rejectionReason).toBeNull();
        });
    });

    describe('GET /api/v1/join-requests (admin list)', () => {
        it('403 — FORBIDDEN for a user who administers no church', async () => {
            const res = await request(app)
                .get('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken));
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('200 — returns PENDING requests by default', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .get('/api/v1/join-requests')
                .set(authHeader(admin.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.requests).toHaveLength(1);
            expect(res.body.requests[0].id).toBe(submit.body.membership.id);
            expect(res.body.requests[0].user.email).toBe(applicant.email);
            expect(res.body.requests[0].church.id).toBe(church.id);
        });

        it('200 — filters by churchId and status', async () => {
            const pendingInOther = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: churchOther.id })
                .expect(201);

            const pendingOnly = await request(app)
                .get(`/api/v1/join-requests?churchId=${church.id}&status=PENDING`)
                .set(authHeader(admin.accessToken));
            expect(pendingOnly.status).toBe(200);
            expect(pendingOnly.body.requests).toHaveLength(0);
            expect(pendingInOther.body.membership.church.name).toBe('Riverside');

            const all = await request(app)
                .get(`/api/v1/join-requests?status=PENDING`)
                .set(authHeader(admin.accessToken));
            expect(all.body.requests).toHaveLength(1);
            expect(all.body.requests[0].church.id).toBe(churchOther.id);
        });

        it('200 — lists REJECTED requests with the stored reason', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            await request(app)
                .post('/api/v1/join-requests/reject')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id, rejectionReason: 'Capacity full' })
                .expect(200);

            const res = await request(app)
                .get(`/api/v1/join-requests?status=REJECTED`)
                .set(authHeader(admin.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.requests).toHaveLength(1);
            expect(res.body.requests[0].rejectionReason).toBe('Capacity full');
        });

        it('403 — FORBIDDEN when the churchId is not administered by the caller', async () => {
            const res = await request(app)
                .get(`/api/v1/join-requests?churchId=${churchOther.id}`)
                .set(authHeader(applicant.accessToken));
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('400 — VALIDATION_FAILED for an unknown status', async () => {
            const res = await request(app)
                .get('/api/v1/join-requests?status=BOGUS')
                .set(authHeader(admin.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('POST /api/v1/join-requests/approve', () => {
        it('200 — approves the request and clears the requester /me cache', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            await request(app)
                .get('/api/v1/auth/me')
                .set(authHeader(applicant.accessToken))
                .expect(200);
            expect(fakeRedis.has(cacheKeys.userMe(applicant.userId))).toBe(true);

            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id });
            expect(res.status).toBe(200);
            expect(res.body.membership.status).toBe('APPROVED');
            expect(fakeRedis.has(cacheKeys.userMe(applicant.userId))).toBe(false);

            const row = await prisma.churchMembership.findUnique({
                where: { id: submit.body.membership.id },
            });
            expect(row?.status).toBe('APPROVED');
        });

        it('200 — approving an already-approved request is idempotent', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id })
                .expect(200);

            const again = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id });
            expect(again.status).toBe(200);
            expect(again.body.message).toMatch(/already been approved/);
        });

        it('403 — FORBIDDEN for the requester themselves (non-admin)', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId: submit.body.membership.id });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('403 — FORBIDDEN for an APPROVED MEMBER of the same church', async () => {
            const memberTom = await registerAndVerify();
            await prisma.churchMembership.create({
                data: { userId: memberTom.userId, churchId: church.id, role: 'MEMBER', status: 'APPROVED' },
            });
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(memberTom.accessToken))
                .send({ membershipId: submit.body.membership.id });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('403 — FORBIDDEN for an admin of a different church', async () => {
            const otherAdmin = await registerAndVerify();
            await prisma.churchMembership.create({
                data: {
                    userId: otherAdmin.userId,
                    churchId: churchOther.id,
                    role: 'SUPER_ADMIN',
                    status: 'APPROVED',
                },
            });
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(otherAdmin.accessToken))
                .send({ membershipId: submit.body.membership.id });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('404 — REQUEST_NOT_FOUND for an unknown membership id', async () => {
            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: '99999999-9999-4999-9999-999999999999' });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('REQUEST_NOT_FOUND');
        });
    });

    describe('POST /api/v1/join-requests/reject', () => {
        it('200 — rejects with the provided reason', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/reject')
                .set(authHeader(admin.accessToken))
                .send({
                    membershipId: submit.body.membership.id,
                    rejectionReason: 'Request does not match our membership requirements',
                });
            expect(res.status).toBe(200);
            expect(res.body.membership.status).toBe('REJECTED');
            expect(res.body.membership.rejectionReason).toBe('Request does not match our membership requirements');
        });

        it('200 — stores no reason when omitted', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/reject')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id });
            expect(res.status).toBe(200);
            expect(res.body.membership.rejectionReason).toBeNull();
        });

        it('200 — approving a previously rejected request clears the reason', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            const membershipId = submit.body.membership.id;
            await request(app)
                .post('/api/v1/join-requests/reject')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, rejectionReason: 'Reapply when seats open' })
                .expect(200);

            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId });
            expect(res.status).toBe(200);
            expect(res.body.membership.status).toBe('APPROVED');
            expect(res.body.membership.rejectionReason).toBeNull();
        });

        it('400 — VALIDATION_FAILED for an overly long reason', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/reject')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.membership.id, rejectionReason: 'x'.repeat(501) });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });
});