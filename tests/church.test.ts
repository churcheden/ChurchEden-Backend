import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { accessTokenFor, authHeader } from './helpers/auth.js';
import { addMembership, createAdmin, createChurch, createUser } from './helpers/seed.js';
import { resetFakes } from './helpers/fakes.js';
import { resetDatabase } from './helpers/db.js';

describe('GET /api/v1/churches — public directory', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    it('200 — lists all registered churches for an authenticated member', async () => {
        const c1 = await createChurch({ name: 'Grace Assembly' });
        const c2 = await createChurch({ name: 'Kingdom Harvest' });
        const member = await createUser();

        const res = await request(app)
            .get('/api/v1/churches')
            .set(authHeader(await accessTokenFor(member.id, member.email)));

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        const ids = res.body.churches.map((c: { id: string }) => c.id);
        expect(ids).toContain(c1.id);
        expect(ids).toContain(c2.id);
        expect(res.body.churches[0].name).toBeTruthy();
        expect(res.body.churches[0].city).toBeTruthy();
    });

    it('200 — ?q= filters churches by name', async () => {
        const c1 = await createChurch({ name: 'Redeemer Chapel' });
        const c2 = await createChurch({ name: 'Grace Assembly' });
        const member = await createUser();

        const res = await request(app)
            .get('/api/v1/churches?q=redeemer')
            .set(authHeader(await accessTokenFor(member.id, member.email)));

        expect(res.status).toBe(200);
        const names = res.body.churches.map((c: { name: string }) => c.name);
        expect(names).toContain(c1.name);
        expect(names).not.toContain(c2.name);
    });

    it('401 — requires authentication', async () => {
        const res = await request(app).get('/api/v1/churches');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/v1/churches/:churchId/leave', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    it('200 — a member leaves their approved church', async () => {
        const church = await createChurch();
        const member = await createUser();
        await addMembership({ userId: member.id, churchId: church.id, status: 'APPROVED' });

        const res = await request(app)
            .post(`/api/v1/churches/${church.id}/leave`)
            .set(authHeader(await accessTokenFor(member.id, member.email)));

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(await prisma.churchMembership.count({ where: { churchId: church.id } })).toBe(0);
    });

    it('404 — NOT_A_MEMBER for a church the user never joined', async () => {
        const church = await createChurch();
        const member = await createUser();

        const res = await request(app)
            .post(`/api/v1/churches/${church.id}/leave`)
            .set(authHeader(await accessTokenFor(member.id, member.email)));

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_A_MEMBER');
    });

    it('409 — NOT_AN_ACTIVE_MEMBER for a pending (not yet approved) membership', async () => {
        const church = await createChurch();
        const member = await createUser();
        await addMembership({ userId: member.id, churchId: church.id, status: 'PENDING' });

        const res = await request(app)
            .post(`/api/v1/churches/${church.id}/leave`)
            .set(authHeader(await accessTokenFor(member.id, member.email)));

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('NOT_AN_ACTIVE_MEMBER');
    });
});

describe('GET /api/v1/churches/:churchId/admins', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    it('200 — returns the church leadership from the Admin table', async () => {
        const church = await createChurch({ name: 'Grace Assembly' });
        const superAdmin = await createAdmin({ churchId: church.id, role: 'SUPER_ADMIN' });
        await createAdmin({ churchId: church.id, role: 'ADMIN' });

        const res = await request(app)
            .get(`/api/v1/churches/${church.id}/admins`)
            .set(authHeader(superAdmin.accessToken));
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.admins).toHaveLength(2);
        expect(res.body.admins[0].role).toBe('SUPER_ADMIN');
        const roles = res.body.admins.map((a: { role: string }) => a.role);
        expect(roles).toContain('SUPER_ADMIN');
        expect(roles).toContain('ADMIN');
        expect(res.body.admins[0].email).toBe(superAdmin.email);
        expect(res.body.admins[0].isActive).toBe(true);
        expect(res.body.admins[0].linkedUserId).toBeTruthy();
    });

    it('403 — FORBIDDEN for a plain member', async () => {
        const church = await createChurch();
        const member = await createUser();
        const memberToken = await accessTokenFor(member.id, member.email);

        const res = await request(app)
            .get(`/api/v1/churches/${church.id}/admins`)
            .set(authHeader(memberToken));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
    });

    it('403 — FORBIDDEN for an admin of a different church', async () => {
        const church = await createChurch();
        const other = await createChurch();
        const otherAdmin = await createAdmin({ churchId: other.id });

        const res = await request(app)
            .get(`/api/v1/churches/${church.id}/admins`)
            .set(authHeader(otherAdmin.accessToken));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
    });
});

describe('DELETE /api/v1/churches/:churchId', () => {
    beforeEach(async () => {
        resetFakes();
        await resetDatabase();
    });

    it('200 — the SUPER_ADMIN deletes the church and cleans up orphaned members', async () => {
        const church = await createChurch({ name: 'Grace Assembly' });
        const superAdmin = await createAdmin({ churchId: church.id, role: 'SUPER_ADMIN' });
        const orphanMember = await createUser();
        await addMembership({ userId: orphanMember.id, churchId: church.id, status: 'APPROVED' });

        const res = await request(app)
            .delete(`/api/v1/churches/${church.id}`)
            .set(authHeader(superAdmin.accessToken));
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/deleted successfully/);

        expect(await prisma.church.findUnique({ where: { id: church.id } })).toBeNull();
        expect(await prisma.admin.findUnique({ where: { id: superAdmin.id } })).toBeNull();
        expect(await prisma.churchMembership.count({ where: { churchId: church.id } })).toBe(0);
        // The member's only church was deleted — their account is orphaned.
        expect(await prisma.user.findUnique({ where: { id: orphanMember.id } })).toBeNull();
    });

    it('200 — retains a member who still belongs to another church', async () => {
        const church = await createChurch();
        const superAdmin = await createAdmin({ churchId: church.id, role: 'SUPER_ADMIN' });
        const other = await createChurch();
        const member = await createUser();
        await addMembership({ userId: member.id, churchId: church.id, status: 'APPROVED' });
        await addMembership({ userId: member.id, churchId: other.id, status: 'APPROVED' });

        const res = await request(app)
            .delete(`/api/v1/churches/${church.id}`)
            .set(authHeader(superAdmin.accessToken));
        expect(res.status).toBe(200);

        expect(await prisma.church.findUnique({ where: { id: church.id } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { id: member.id } })).not.toBeNull();
    });

    it('403 — FORBIDDEN for a non-super-admin of the church', async () => {
        const church = await createChurch();
        const admin = await createAdmin({ churchId: church.id, role: 'ADMIN' });

        const res = await request(app)
            .delete(`/api/v1/churches/${church.id}`)
            .set(authHeader(admin.accessToken));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
    });

    it('403 — FORBIDDEN for a foreign or unknown church id (guard runs before the controller)', async () => {
        const church = await createChurch();
        const superAdmin = await createAdmin({ churchId: church.id, role: 'SUPER_ADMIN' });

        const res = await request(app)
            .delete(`/api/v1/churches/${'99999999-9999-4999-9999-999999999999'}`)
            .set(authHeader(superAdmin.accessToken));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
    });
});