import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { accessTokenFor, authHeader } from './helpers/auth.js';
import { addMembership, createAdmin, createChurch, createUser } from './helpers/seed.js';
import { resetFakes } from './helpers/fakes.js';
import { resetDatabase } from './helpers/db.js';

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