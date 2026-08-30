import { PutObjectCommand } from '@aws-sdk/client-s3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { cloudflare } from '../src/config/cloudflare.js';
import { env } from '../src/env.js';
import { cacheKeys, CacheService } from '../src/utils/cache.js';
import { fakeRedis, resetFakes } from './helpers/fakes.js';
import { authHeader, registerAndVerify } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';

const step1 = (churchName: string) => ({
    firstName: 'Ada',
    lastName: 'Okafor',
    churchName,
    denomination: 'Pentecostal',
    congregationSize: 'RANGE_101_500',
    foundedYear: 1990,
});

const step2 = {
    country: 'NG',
    city: 'Lagos',
    address: '12 Broad Street',
    phone: '+2348012345678',
    email: 'grace@assembly.test',
    primaryLanguage: 'ENGLISH',
    timeZone: 'Africa/Lagos',
};

const serviceTimes = [
    { label: 'Sunday Service', dayOfWeek: 0, time: '09:00' },
    { label: 'Bible Study', dayOfWeek: 3, time: '18:30' },
];

const step4 = {
    ministryIds: [
        '11111111-1111-4a11-8b11-111111111111',
        '22222222-2222-4a22-8b22-222222222222',
    ],
    customMinistries: [
        { name: 'Media Crew', type: 'DEPARTMENT', description: 'A/V and streaming' },
    ],
};

const patch = (accessToken: string, path: string, body: unknown) =>
    request(app)
        .patch(`/api/v1/onboarding/church/${path}`)
        .set(authHeader(accessToken))
        .send(body);

const patchStep3Multipart = (accessToken: string) =>
    request(app)
        .patch('/api/v1/onboarding/church/step-3')
        .set(authHeader(accessToken))
        .field('serviceTimes', JSON.stringify(serviceTimes));

const seedSteps1to3 = async (accessToken: string, churchName: string) => {
    await patch(accessToken, 'step-1', step1(churchName)).expect(200);
    await patch(accessToken, 'step-2', step2).expect(200);
    await patch(accessToken, 'step-3', { serviceTimes }).expect(200);
};

describe('onboarding', () => {
    let user: Awaited<ReturnType<typeof registerAndVerify>>;

    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
        user = await registerAndVerify();
        vi.spyOn(cloudflare, 'send').mockResolvedValue({} as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('401 — every step requires a valid access token', async () => {
        const res = await request(app)
            .patch('/api/v1/onboarding/church/step-1')
            .send(step1('Grace Assembly'));
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('MISSING_TOKEN');
    });

    describe('PATCH step-1', () => {
        it('200 — saves and merges step-1 data on re-submission', async () => {
            const first = await patch(user.accessToken, 'step-1', step1('Grace Assembly'));
            expect(first.status).toBe(200);
            expect(first.body.draft.firstName).toBe('Ada');

            const second = await patch(user.accessToken, 'step-1', step1('Grace Cathedral'));
            expect(second.status).toBe(200);
            expect(second.body.draft.churchName).toBe('Grace Cathedral');
            expect(second.body.draft.firstName).toBe('Ada');

            expect(fakeRedis.has(cacheKeys.churchOnboardingDraft(user.userId))).toBe(true);
        });

        it('400 — VALIDATION_FAILED for unknown congregation size', async () => {
            const res = await patch(user.accessToken, 'step-1', {
                ...step1('X'),
                congregationSize: 'HUGE',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('400 — VALIDATION_FAILED for a future founded year', async () => {
            const res = await patch(user.accessToken, 'step-1', {
                ...step1('X'),
                foundedYear: 3000,
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('PATCH step-2', () => {
        it('404 — DRAFT_NOT_FOUND when no step-1 draft exists', async () => {
            const res = await patch(user.accessToken, 'step-2', step2);
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('DRAFT_NOT_FOUND');
        });

        it('200 — validates the phone against the country and normalizes to E.164', async () => {
            await patch(user.accessToken, 'step-1', step1('Grace Assembly')).expect(200);
            const res = await patch(user.accessToken, 'step-2', step2);
            expect(res.status).toBe(200);
            expect(res.body.draft.phone).toBe('+2348012345678');
            expect(res.body.draft.country).toBe('NG');
        });

        it('400 — INVALID_PHONE when the phone cannot be parsed', async () => {
            await patch(user.accessToken, 'step-1', step1('Grace Assembly')).expect(200);
            const res = await patch(user.accessToken, 'step-2', {
                ...step2,
                phone: 'not-a-phone',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_PHONE');
        });

        it('400 — VALIDATION_FAILED for a bad time zone', async () => {
            await patch(user.accessToken, 'step-1', step1('Grace Assembly')).expect(200);
            const res = await patch(user.accessToken, 'step-2', {
                ...step2,
                timeZone: 'Mars/Olympus',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('200 — accepts "UTC" and normalizes it to Etc/UTC in the draft', async () => {
            await patch(user.accessToken, 'step-1', step1('Grace Assembly')).expect(200);
            const res = await patch(user.accessToken, 'step-2', { ...step2, timeZone: 'UTC' });
            expect(res.status).toBe(200);

            const draft = await CacheService.get<{ timeZone: string }>(
                cacheKeys.churchOnboardingDraft(user.userId),
            );
            expect(draft?.timeZone).toBe('Etc/UTC');
        });

        it('200 — accepts lowercase "utc" and normalizes it the same way', async () => {
            await patch(user.accessToken, 'step-1', step1('Grace Assembly')).expect(200);
            const res = await patch(user.accessToken, 'step-2', { ...step2, timeZone: 'utc' });
            expect(res.status).toBe(200);
            const draft = await CacheService.get<{ timeZone: string }>(
                cacheKeys.churchOnboardingDraft(user.userId),
            );
            expect(draft?.timeZone).toBe('Etc/UTC');
        });
    });

    describe('PATCH step-3 (service times + logo)', () => {
        it('404 — DRAFT_NOT_FOUND when nothing has been saved yet', async () => {
            const res = await patch(user.accessToken, 'step-3', { serviceTimes });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('DRAFT_NOT_FOUND');
        });

        it('200 — saves service times from a JSON array', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const draft = await CacheService.get<{ serviceTimes: typeof serviceTimes }>(
                cacheKeys.churchOnboardingDraft(user.userId),
            );
            expect(draft?.serviceTimes).toHaveLength(2);
            expect(draft?.serviceTimes[1].time).toBe('18:30');
        });

        it('200 — uploads a logo and stores the public URL', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patchStep3Multipart(user.accessToken)
                .attach('logo', Buffer.from('fake-png'), {
                    filename: 'logo.png',
                    contentType: 'image/png',
                });
            expect(res.status).toBe(200);
            expect(res.body.draft.logoUrl).toMatch(
                new RegExp(`^${env.CLOUDFLARE_R2_PUBLIC_URL}/church-logos/${user.userId}/[0-9a-f-]{36}\\.png$`),
            );

            expect(cloudflare.send).toHaveBeenCalledTimes(1);
            const command = (cloudflare.send as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
            expect(command).toBeInstanceOf(PutObjectCommand);
            expect(command.input.Key.startsWith(`church-logos/${user.userId}/`)).toBe(true);
        });

        it('400 — INVALID_LOGO for a non-image file', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patchStep3Multipart(user.accessToken)
                .attach('logo', Buffer.from('x'), { filename: 'logo.txt', contentType: 'text/plain' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_LOGO');
        });

        it('400 — LOGO_TOO_LARGE via multer when the logo exceeds 2MB', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patchStep3Multipart(user.accessToken)
                .attach('logo', Buffer.alloc(2 * 1024 * 1024 + 1, 1), {
                    filename: 'big.png',
                    contentType: 'image/png',
                });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('LOGO_TOO_LARGE');
        });

        it('400 — VALIDATION_FAILED for non-24h time format', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patch(user.accessToken, 'step-3', {
                serviceTimes: [{ label: 'X', dayOfWeek: 0, time: '9:00' }],
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('400 — VALIDATION_FAILED when serviceTimes is empty', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patch(user.accessToken, 'step-3', { serviceTimes: [] });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('PATCH step-4 (ministries)', () => {
        it('200 — saves selected and custom ministries', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patch(user.accessToken, 'step-4', step4);
            expect(res.status).toBe(200);
            expect(res.body.draft.ministryIds).toHaveLength(2);
            expect(res.body.draft.customMinistries[0].name).toBe('Media Crew');
        });

        it('400 — VALIDATION_FAILED for a non-uuid ministry id', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const res = await patch(user.accessToken, 'step-4', {
                ministryIds: ['not-a-uuid'],
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('GET /draft', () => {
        it('200 — returns an empty draft before any step', async () => {
            const res = await request(app)
                .get('/api/v1/onboarding/church/draft')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.draft).toEqual({});
        });

        it('200 — accumulates progress across steps', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            await patch(user.accessToken, 'step-4', step4).expect(200);
            const res = await request(app)
                .get('/api/v1/onboarding/church/draft')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.draft.churchName).toBe('Grace Assembly');
            expect(res.body.draft.serviceTimes).toHaveLength(2);
        });
    });

    describe('POST /complete', () => {
        it('404 — DRAFT_NOT_FOUND when nothing was saved', async () => {
            const res = await request(app)
                .post('/api/v1/onboarding/church/complete')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('DRAFT_NOT_FOUND');
        });

        it('400 — INCOMPLETE_ONBOARDING when steps are missing', async () => {
            await patch(user.accessToken, 'step-1', step1('Grace Assembly')).expect(200);
            const res = await request(app)
                .post('/api/v1/onboarding/church/complete')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INCOMPLETE_ONBOARDING');
            expect(res.body.message).toContain('step-2');
            expect(res.body.message).toContain('step-3');
        });

        it('400 — INVALID_MINISTRY_ID for an unknown ministry without creating the church', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            await patch(user.accessToken, 'step-4', {
                ministryIds: ['99999999-9999-4999-9999-999999999999'],
            }).expect(200);

            const res = await request(app)
                .post('/api/v1/onboarding/church/complete')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_MINISTRY_ID');
            expect(await prisma.church.count()).toBe(0);
            expect(fakeRedis.has(cacheKeys.churchOnboardingDraft(user.userId))).toBe(true);
        });

        it('400 — DUPLICATE_MINISTRY_NAME when a custom ministry repeats a selected one', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            await patch(user.accessToken, 'step-4', {
                ministryIds: ['11111111-1111-4a11-8b11-111111111111'],
                customMinistries: [{ name: 'Worship & Music Ministry', type: 'MINISTRY' }],
            }).expect(200);

            const res = await request(app)
                .post('/api/v1/onboarding/church/complete')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('DUPLICATE_MINISTRY_NAME');
        });

        it('200 — creates church, service times, ministries, admin membership and clears the draft', async () => {
            await seedSteps1to3(user.accessToken, 'Grace Assembly');
            const duplicateIds = [...step4.ministryIds, '11111111-1111-4a11-8b11-111111111111'];
            await patch(user.accessToken, 'step-4', {
                ministryIds: duplicateIds,
                customMinistries: step4.customMinistries,
            }).expect(200);

            const res = await request(app)
                .post('/api/v1/onboarding/church/complete')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.church.name).toBe('Grace Assembly');
            expect(res.body.membership.role).toBe('SUPER_ADMIN');
            expect(res.body.membership.status).toBe('APPROVED');

            const church = await prisma.church.findFirst({ where: { name: 'Grace Assembly' } });
            expect(church?.denomination).toBe('Pentecostal');
            expect(church?.country).toBe('NG');
            expect(church?.foundedYear).toBe(1990);

            const serviceTimesDb = await prisma.serviceTime.count({ where: { churchId: church!.id } });
            expect(serviceTimesDb).toBe(2);

            const ministriesDb = await prisma.churchMinistry.findMany({ where: { churchId: church!.id } });
            expect(ministriesDb).toHaveLength(3);
            expect(ministriesDb.some((m) => m.name === 'Media Crew' && m.isCustom)).toBe(true);
            expect(ministriesDb.filter((m) => m.name === 'Worship & Music Ministry')).toHaveLength(1);

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.fullName).toBe('Ada Okafor');

            expect(fakeRedis.has(cacheKeys.churchOnboardingDraft(user.userId))).toBe(false);
            expect(fakeRedis.has(cacheKeys.userMe(user.userId))).toBe(false);
        });

        it('200 — leaves logoUrl and foundedYear null when not provided', async () => {
            await patch(user.accessToken, 'step-1', {
                firstName: 'Ada',
                lastName: 'Okafor',
                churchName: 'Cornerstone Chapel',
                denomination: 'Anglican',
                congregationSize: 'RANGE_1_100',
            }).expect(200);
            await patch(user.accessToken, 'step-2', { ...step2, timeZone: 'Europe/London' }).expect(200);
            await patch(user.accessToken, 'step-3', { serviceTimes }).expect(200);

            const res = await request(app)
                .post('/api/v1/onboarding/church/complete')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(200);

            const church = await prisma.church.findFirst({ where: { name: 'Cornerstone Chapel' } });
            expect(church?.foundedYear).toBeNull();
            expect(church?.logoUrl).toBeNull();
        });
    });
});