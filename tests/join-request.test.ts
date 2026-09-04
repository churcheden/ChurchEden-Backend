import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { cacheKeys, CacheService } from '../src/utils/cache.js';
import { fakeRedis, resetFakes } from './helpers/fakes.js';
import { authHeader, registerAndVerify } from './helpers/auth.js';
import { createAdmin } from './helpers/seed.js';
import { resetDatabase } from './helpers/db.js';

const createChurch = async (name: string) => {
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
            superAdmin: {
                create: {
                    email: `${randomUUID()}@admin.test`,
                    fullName: 'Admin ' + name,
                    isVerified: true,
                },
            },
        },
    });
    return church;
};

describe('join-requests', () => {
    let admin: Awaited<ReturnType<typeof createAdmin>>;
    let applicant: Awaited<ReturnType<typeof registerAndVerify>>;
    let church: Awaited<ReturnType<typeof createChurch>>;
    let churchOther: Awaited<ReturnType<typeof createChurch>>;

    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
        applicant = await registerAndVerify();
        church = await createChurch('Grace Assembly');
        churchOther = await createChurch('Riverside');
        admin = await createAdmin({ churchId: church.id });
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
            expect(res.body.member.status).toBe('PENDING');
            expect(res.body.member.role).toBe('MEMBER');
            expect(res.body.member.church.name).toBe('Grace Assembly');
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
                .send({ membershipId: submit.body.member.id })
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
            const membershipId = submit.body.member.id;

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
            expect(resubmit.body.member.status).toBe('PENDING');
            expect(resubmit.body.member.rejectionReason).toBeNull();

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
            expect(res.body.requests[0].id).toBe(submit.body.member.id);
            expect(res.body.requests[0].user.email).toBe(applicant.email);
            expect(res.body.requests[0].church.id).toBe(church.id);
        });

        it('200 — returns only the caller\'s administered church requests', async () => {
            await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            // A request to a church this admin does not administer is out of scope.
            await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: churchOther.id })
                .expect(201);

            const all = await request(app)
                .get(`/api/v1/join-requests?status=PENDING`)
                .set(authHeader(admin.accessToken));
            expect(all.status).toBe(200);
            expect(all.body.requests).toHaveLength(1);
            expect(all.body.requests[0].church.id).toBe(church.id);

            const filtered = await request(app)
                .get(`/api/v1/join-requests?churchId=${church.id}&status=PENDING`)
                .set(authHeader(admin.accessToken));
            expect(filtered.status).toBe(200);
            expect(filtered.body.requests).toHaveLength(1);
            expect(filtered.body.requests[0].church.id).toBe(church.id);
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
                .send({ membershipId: submit.body.member.id, rejectionReason: 'Capacity full' })
                .expect(200);

            const res = await request(app)
                .get(`/api/v1/join-requests?status=REJECTED`)
                .set(authHeader(admin.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.requests).toHaveLength(1);
            expect(res.body.requests[0].rejectionReason).toBe('Capacity full');
        });

        it('403 — FORBIDDEN when the churchId is not administered by the caller', async () => {
            const otherAdmin = await createAdmin({ churchId: churchOther.id });
            const res = await request(app)
                .get(`/api/v1/join-requests?churchId=${church.id}`)
                .set(authHeader(otherAdmin.accessToken));
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
                .send({ membershipId: submit.body.member.id });
            expect(res.status).toBe(200);
            expect(res.body.member.status).toBe('APPROVED');
            expect(fakeRedis.has(cacheKeys.userMe(applicant.userId))).toBe(false);

            const row = await prisma.churchMembership.findUnique({
                where: { id: submit.body.member.id },
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
                .send({ membershipId: submit.body.member.id })
                .expect(200);

            const again = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.member.id });
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
                .send({ membershipId: submit.body.member.id });
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
                .send({ membershipId: submit.body.member.id });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('403 — FORBIDDEN for an admin of a different church', async () => {
            const otherAdmin = await createAdmin({ churchId: churchOther.id });
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(otherAdmin.accessToken))
                .send({ membershipId: submit.body.member.id });
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
                    membershipId: submit.body.member.id,
                    rejectionReason: 'Request does not match our membership requirements',
                });
            expect(res.status).toBe(200);
            expect(res.body.member.status).toBe('REJECTED');
            expect(res.body.member.rejectionReason).toBe('Request does not match our membership requirements');
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
                .send({ membershipId: submit.body.member.id });
            expect(res.status).toBe(200);
            expect(res.body.member.rejectionReason).toBeNull();
        });

        it('200 — approving a previously rejected request clears the reason', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            const membershipId = submit.body.member.id;
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
            expect(res.body.member.status).toBe('APPROVED');
            expect(res.body.member.rejectionReason).toBeNull();
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
                .send({ membershipId: submit.body.member.id, rejectionReason: 'x'.repeat(501) });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('POST /api/v1/join-requests/ban', () => {
        const submitRequest = async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            return submit.body.member.id;
        };

        it('200 — bans the user and clears the requester /me cache', async () => {
            const membershipId = await submitRequest();

            const res = await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, banReason: 'Repeated spam requests' });
            expect(res.status).toBe(200);
            expect(res.body.member.isBanned).toBe(true);
            expect(res.body.member.banReason).toBe('Repeated spam requests');
            expect(res.body.member.status).toBe('REJECTED');

            const row = await prisma.churchMembership.findUnique({ where: { id: membershipId } });
            expect(row?.isBanned).toBe(true);
            expect(row?.banReason).toBe('Repeated spam requests');
            expect(row?.bannedAt).not.toBeNull();
        });

        it('403 — FORBIDDEN for the applicant themselves (non-admin)', async () => {
            const membershipId = await submitRequest();
            const res = await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId, banReason: 'Any reason' });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('403 — FORBIDDEN for an admin of a different church', async () => {
            const otherAdmin = await createAdmin({ churchId: churchOther.id });
            const membershipId = await submitRequest();
            const res = await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(otherAdmin.accessToken))
                .send({ membershipId, banReason: 'Any reason' });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('404 — REQUEST_NOT_FOUND for an unknown membership id', async () => {
            const res = await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: '99999999-9999-4999-9999-999999999999', banReason: 'Any reason' });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('REQUEST_NOT_FOUND');
        });

        it('200 — banning an already-banned user is idempotent', async () => {
            const membershipId = await submitRequest();
            await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, banReason: 'First ban' })
                .expect(200);

            const again = await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, banReason: 'Second ban' });
            expect(again.status).toBe(200);
            expect(again.body.message).toMatch(/already banned/);
        });

        it('400 — VALIDATION_FAILED for an overly long ban reason', async () => {
            const membershipId = await submitRequest();
            const res = await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, banReason: 'x'.repeat(501) });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('POST /api/v1/join-requests/unban', () => {
        it('200 — unbans a banned user and lets them re-apply', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            const membershipId = submit.body.member.id;
            await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, banReason: 'Spam' })
                .expect(200);

            const res = await request(app)
                .post('/api/v1/join-requests/unban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId });
            expect(res.status).toBe(200);
            expect(res.body.member.isBanned).toBe(false);
            expect(res.body.member.banReason).toBeNull();
            expect(res.body.member.bannedAt).toBeNull();

            const resubmit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id });
            expect(resubmit.status).toBe(200);
            expect(resubmit.body.member.status).toBe('PENDING');
        });

        it('403 — FORBIDDEN for the banned user themselves', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            const membershipId = submit.body.member.id;
            await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId, banReason: 'Spam' })
                .expect(200);

            const res = await request(app)
                .post('/api/v1/join-requests/unban')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('200 — unbanning a non-banned user is a no-op', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/unban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.member.id });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/not banned/);
        });
    });

    describe('POST /api/v1/join-requests — banned user cannot re-apply', () => {
        it('403 — BANNED_FROM_CHURCH when the user is already banned', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            await request(app)
                .post('/api/v1/join-requests/ban')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.member.id, banReason: 'Spam' })
                .expect(200);

            const res = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('BANNED_FROM_CHURCH');
        });
    });

    describe('POST /api/v1/join-requests/cancel', () => {
        it('200 — a member withdraws their pending request (row removed from dashboard)', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            const membershipId = submit.body.member.id;

            const res = await request(app)
                .post('/api/v1/join-requests/cancel')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            // Gone from the admin PENDING dashboard entirely.
            expect(await prisma.churchMembership.findUnique({ where: { id: membershipId } })).toBeNull();
        });

        it('200 — after cancelling, the member can apply to a different church', async () => {
            await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const otherSubmit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: churchOther.id })
                .expect(201);

            // Cancel the first (church) request, keep the new one (churchOther).
            const toCancel = await prisma.churchMembership.findFirst({
                where: { churchId: church.id },
                select: { id: true },
            });
            expect(toCancel).not.toBeNull();
            const cancel = await request(app)
                .post('/api/v1/join-requests/cancel')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId: toCancel!.id });
            expect(cancel.status).toBe(200);

            expect(await prisma.churchMembership.count({ where: { churchId: church.id } })).toBe(0);
            expect(otherSubmit.body.membership.status).toBe('PENDING');
        });

        it('403 — FORBIDDEN for a request owned by a different user', async () => {
            const other = await registerAndVerify();
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);

            const res = await request(app)
                .post('/api/v1/join-requests/cancel')
                .set(authHeader(other.accessToken))
                .send({ membershipId: submit.body.member.id });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        it('404 — REQUEST_NOT_FOUND for an unknown membership id', async () => {
            const res = await request(app)
                .post('/api/v1/join-requests/cancel')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId: '99999999-9999-4999-9999-999999999999' });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('REQUEST_NOT_FOUND');
        });

        it('409 — REQUEST_NOT_PENDING for an already-approved membership', async () => {
            const submit = await request(app)
                .post('/api/v1/join-requests')
                .set(authHeader(applicant.accessToken))
                .send({ churchId: church.id })
                .expect(201);
            await request(app)
                .post('/api/v1/join-requests/approve')
                .set(authHeader(admin.accessToken))
                .send({ membershipId: submit.body.member.id })
                .expect(200);

            const res = await request(app)
                .post('/api/v1/join-requests/cancel')
                .set(authHeader(applicant.accessToken))
                .send({ membershipId: submit.body.membership.id });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('REQUEST_NOT_PENDING');
        });
    });
});