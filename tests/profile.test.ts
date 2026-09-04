import { PutObjectCommand } from '@aws-sdk/client-s3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { cloudflare } from '../src/config/cloudflare.js';
import { env } from '../src/env.js';
import { cacheKeys } from '../src/utils/cache.js';
import { fakeRedis, resetFakes } from './helpers/fakes.js';
import { authHeader, registerAndVerify, accessTokenFor } from './helpers/auth.js';
import { createChurch, createUser } from './helpers/seed.js';
import { resetDatabase } from './helpers/db.js';

const validFields = {
    fullName: 'Test Member',
    dateOfBirth: '1995-05-15',
    gender: 'MALE',
    phoneNumber: '+2348012345678',
    contactEmail: 'member@test.com',
    city: 'Lagos',
    address: '1 Test Street',
    maritalStatus: 'SINGLE',
};

const completeProfile = (accessToken: string, fields: Record<string, string>) => {
    let req = request(app)
        .post('/api/v1/members/profile/complete')
        .set(authHeader(accessToken));
    for (const [key, value] of Object.entries(fields)) {
        req = req.field(key, value);
    }
    return req;
};

describe('profile', () => {
    let user: Awaited<ReturnType<typeof registerAndVerify>>;

    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
        const church = await createChurch();
        const created = await createUser({ churchId: church.id });
        await prisma.member.update({
            where: { id: created.id },
            data: { status: 'APPROVED', role: 'MEMBER' },
        });
        const accessToken = await accessTokenFor(created.id, created.email);
        user = {
            email: created.email,
            password: 'Password123!',
            userId: created.id,
            accessToken,
            refreshToken: 'fake-refresh-token',
        };
        vi.spyOn(cloudflare, 'send').mockResolvedValue({} as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/v1/members/profile', () => {
        it('401 — MISSING_TOKEN / INVALID_TOKEN', async () => {
            const missing = await request(app).get('/api/v1/members/profile');
            expect(missing.status).toBe(401);
            expect(missing.body.code).toBe('MISSING_TOKEN');

            const bad = await request(app)
                .get('/api/v1/members/profile')
                .set(authHeader('garbage'));
            expect(bad.status).toBe(401);
            expect(bad.body.code).toBe('INVALID_TOKEN');
        });

        it('404 — PROFILE_NOT_FOUND before the profile is completed', async () => {
            const res = await request(app)
                .get('/api/v1/members/profile')
                .set(authHeader(user.accessToken));
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('PROFILE_NOT_FOUND');
        });
    });

    describe('POST /api/v1/members/profile/complete', () => {
        it('200 — creates the profile, updates the user name and invalidates /me cache', async () => {
            const res = await completeProfile(user.accessToken, validFields);
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.profile.fullName).toBe('Test Member');

            const profile = await prisma.memberProfile.findUnique({ where: { userId: user.userId } });
            expect(profile?.phoneNumber).toBe('+2348012345678');
            expect(profile?.gender).toBe('MALE');

            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            expect(dbUser?.fullName).toBe('Test Member');

            expect(fakeRedis.has(cacheKeys.userMe(user.userId))).toBe(false);

            const get = await request(app)
                .get('/api/v1/members/profile')
                .set(authHeader(user.accessToken));
            expect(get.status).toBe(200);
            expect(get.body.profile.fullName).toBe('Test Member');
        });

        it('200 — uploads a profile photo to Cloudflare R2 and returns its public URL', async () => {
            const photo = Buffer.from('fake-png-bytes');
            const res = await completeProfile(user.accessToken, validFields)
                .attach('profilePhoto', photo, { filename: 'portrait.png', contentType: 'image/png' });
            expect(res.status).toBe(200);

            expect(cloudflare.send).toHaveBeenCalledTimes(1);
            const command = (cloudflare.send as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
            expect(command).toBeInstanceOf(PutObjectCommand);
            expect(command.input.Key).toMatch(
                new RegExp(`^member-photos/${user.userId}/[0-9a-f-]{36}\\.png$`),
            );
            expect(command.input.Bucket).toBe(env.CLOUDFLARE_R2_BUCKET_NAME);

            const photoUrl = res.body.profile.profilePhotoUrl as string;
            expect(photoUrl).toContain(`/member-photos/${user.userId}/`);
            expect(photoUrl).toMatch(/\.png$/);
            expect(photoUrl.startsWith(env.CLOUDFLARE_R2_PUBLIC_URL)).toBe(true);
        });

        it('200 — re-saving without a photo keeps the existing photo (no re-upload)', async () => {
            const first = await completeProfile(user.accessToken, validFields)
                .attach('profilePhoto', Buffer.from('png-1'), { filename: 'a.png', contentType: 'image/png' });
            const firstUrl = first.body.profile.profilePhotoUrl as string;

            const second = await completeProfile(user.accessToken, validFields);
            expect(second.status).toBe(200);
            expect(second.body.profile.profilePhotoUrl).toBe(firstUrl);

            expect(cloudflare.send).toHaveBeenCalledTimes(1);
        });

        it('400 — INVALID_PHOTO when the uploaded file is not an image', async () => {
            const res = await completeProfile(user.accessToken, validFields)
                .attach('profilePhoto', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_PHOTO');
        });

        it('400 — PHOTO_TOO_LARGE via multer when the file exceeds 5MB', async () => {
            const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
            const res = await completeProfile(user.accessToken, validFields)
                .attach('profilePhoto', big, { filename: 'big.png', contentType: 'image/png' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PHOTO_TOO_LARGE');
        });

        it('400 — INVALID_PHONE for an unscannable number', async () => {
            const res = await completeProfile(user.accessToken, {
                ...validFields,
                phoneNumber: 'not-a-phone-number',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_PHONE');
        });

        it('400 — VALIDATION_FAILED for a future date of birth', async () => {
            const res = await completeProfile(user.accessToken, {
                ...validFields,
                dateOfBirth: '2999-01-01',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('400 — VALIDATION_FAILED for an unknown gender', async () => {
            const res = await completeProfile(user.accessToken, {
                ...validFields,
                gender: 'OTHER',
            });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
        });

        it('400 — VALIDATION_FAILED when fields are missing', async () => {
            const res = await request(app)
                .post('/api/v1/members/profile/complete')
                .set(authHeader(user.accessToken))
                .field('fullName', 'Only Name');
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_FAILED');
            expect(res.body.details.length).toBeGreaterThan(0);
        });

        it('200 — the same phone number may be used by two different users', async () => {
            const other = await registerAndVerify();
            const res = await completeProfile(other.accessToken, { ...validFields, phoneNumber: '+2348012345678' });
            expect(res.status).toBe(200);
            expect(res.body.profile.phoneNumber).toBe('+2348012345678');
        });
    });
});