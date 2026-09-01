import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { wideLogger } from '../utils/wideLogger.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CacheService, cacheKeys } from '../utils/cache.js';

// DELETE /api/v1/churches/:churchId
// Guarded by requireSuperAdmin — only the church's SUPER_ADMIN can delete it.
//
// The church and all cascading children (memberships, admins, service times,
// ministries, etc.) are removed within a single transaction via the schema's
// onDelete: Cascade relations. Afterward, member Users that ended up with no
// church memberships and are not linked to any Admin are cleaned up too (they
// lose their only church and would otherwise linger as empty accounts).
export const deleteChurch = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'delete_church');
    const churchId = (req as AuthenticatedRequest & { churchId?: string }).churchId ?? (req.params as { churchId?: string }).churchId;

    if (!churchId) {
        throw new AppError('Church id is required!', 400, 'MISSING_CHURCH_ID');
    }

    wideLogger.addCtx('church_id', churchId);

    const church = await prisma.church.findUnique({
        where: { id: churchId },
        select: { id: true, name: true },
    });

    if (!church) {
        throw new AppError('Church not found!', 404, 'CHURCH_NOT_FOUND');
    }

    // Capture the member Users before the church deletion cascades memberships
    // away, so we can decide whether any of them are now orphaned.
    const memberUserIds = await prisma.churchMembership.findMany({
        where: { churchId },
        select: { userId: true },
    });
    const userIds = [...new Set(memberUserIds.map((m) => m.userId))];

    await prisma.$transaction(async (tx) => {
        await tx.church.delete({ where: { id: churchId } });
    });

    // Conditional cleanup: delete member Users who have no remaining church
    // memberships and are not behind an Admin row (admins are a separate login
    // identity and may still be active elsewhere).
    if (userIds.length > 0) {
        const linkedToAdmin = new Set(
            (await prisma.admin.findMany({
                where: { linkedUserId: { in: userIds } },
                select: { linkedUserId: true },
            })).map((a) => a.linkedUserId),
        );

        for (const userId of userIds) {
            if (linkedToAdmin.has(userId)) continue;

            const remaining = await prisma.churchMembership.count({
                where: { userId },
            });
            if (remaining === 0) {
                await prisma.user.delete({ where: { id: userId } });
                wideLogger.addCtx(`orphaned_user_${userId}`, 'deleted');
            }
        }
    }

    await CacheService.invalidatePattern(`church:${churchId}:*`);

    wideLogger.addCtx('delete_church_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: `Church "${church.name}" deleted successfully.`,
    });
});

// GET /api/v1/churches/:churchId/admins
// Guarded to ADMIN/SUPER_ADMIN of that church. Returns the church's leadership
// from the Admin table (admin privileges never live on ChurchMembership rows).
export const getChurchAdmins = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_church_admins');
    const churchId = (req as AuthenticatedRequest & { churchId?: string }).churchId ?? (req.params as { churchId?: string }).churchId;

    if (!churchId) {
        throw new AppError('Church id is required!', 400, 'MISSING_CHURCH_ID');
    }

    wideLogger.addCtx('church_id', churchId);

    const admins = await prisma.admin.findMany({
        where: { churchId },
        select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            loginProvider: true,
            createdAt: true,
            linkedUserId: true,
            linkedUser: { select: { id: true, fullName: true, email: true, lastLogin: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    wideLogger.addCtx('get_church_admins_result', 'success');
    return res.status(200).json({
        status: 'success',
        admins,
    });
});
