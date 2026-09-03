import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { wideLogger } from '../utils/wideLogger.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CacheService, cacheKeys } from '../utils/cache.js';

// GET /api/v1/churches — public directory of registered churches
export const listChurches = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'list_churches');
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const churches = await prisma.church.findMany({
        ...(q
            ? {
                  where: {
                      OR: [
                          { name: { contains: q, mode: 'insensitive' } },
                          { city: { contains: q, mode: 'insensitive' } },
                          { country: { contains: q, mode: 'insensitive' } },
                          { address: { contains: q, mode: 'insensitive' } },
                      ],
                  },
              }
            : {}),
        select: {
            id: true,
            name: true,
            denomination: true,
            country: true,
            city: true,
            address: true,
            logoUrl: true,
            createdAt: true,
        },
        orderBy: { name: 'asc' },
    });

    wideLogger.addCtx('list_churches_result', 'success');
    return res.status(200).json({
        status: 'success',
        churches,
    });
});

// POST /api/v1/churches/:churchId/leave
// A member leaves a church — their Member record is deleted since
// Member IS the membership (churchId is required).
export const leaveChurch = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'leave_church');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    if (req.user?.accountType !== 'MEMBER') {
        throw new AppError('Only church members can leave a church.', 403, 'FORBIDDEN');
    }

    const churchId = (req.params as { churchId?: string }).churchId;
    if (!churchId) {
        throw new AppError('Church id is required!', 400, 'MISSING_CHURCH_ID');
    }

    wideLogger.addCtx('user_id', userId);
    wideLogger.addCtx('church_id', churchId);

    const member = await prisma.member.findFirst({
        where: { id: userId, churchId },
        select: { id: true, status: true },
    });

    if (!member) {
        wideLogger.addCtx('leave_church', 'not_a_member');
        throw new AppError('You are not a member of this church.', 404, 'NOT_A_MEMBER');
    }

    if (member.status !== 'APPROVED') {
        wideLogger.addCtx('leave_church', 'not_active');
        throw new AppError(
            'Only an active membership can be left.',
            409,
            'NOT_AN_ACTIVE_MEMBER',
        );
    }

    // Leaving detaches the member from the church — the Member account (and
    // its Google link / profile) is preserved so they can join elsewhere.
    await prisma.member.update({
        where: { id: member.id },
        data: {
            churchId: null,
            status: 'PENDING',
            rejectionReason: null,
        },
    });

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('leave_church_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'You have left the church successfully.',
    });
});

// DELETE /api/v1/churches/:churchId
// Guarded by requireSuperAdmin — only the church's SuperAdmin can delete it.
// Church deletion cascades to Members, ServiceTimes, Ministries via schema.
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

    // Church deletion cascades to Members (which cascades to MemberProfile,
    // MemberRefreshTokens, ChurchRequests), ServiceTimes, and Ministries.
    await prisma.$transaction(async (tx) => {
        await tx.church.delete({ where: { id: churchId } });
    });

    await CacheService.invalidatePattern(`church:${churchId}:*`);

    wideLogger.addCtx('delete_church_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: `Church "${church.name}" deleted successfully.`,
    });
});

// GET /api/v1/churches/:churchId/admins
// Returns the SuperAdmin who owns the church, plus any Members with
// ADMIN or SUPER_ADMIN role in that church.
export const getChurchAdmins = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_church_admins');
    const churchId = (req as AuthenticatedRequest & { churchId?: string }).churchId ?? (req.params as { churchId?: string }).churchId;

    if (!churchId) {
        throw new AppError('Church id is required!', 400, 'MISSING_CHURCH_ID');
    }

    wideLogger.addCtx('church_id', churchId);

    const church = await prisma.church.findUnique({
        where: { id: churchId },
        select: {
            superAdmin: {
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    isVerified: true,
                    loginProvider: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!church) {
        throw new AppError('Church not found!', 404, 'CHURCH_NOT_FOUND');
    }

    const memberAdmins = await prisma.member.findMany({
        where: {
            churchId,
            role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
        select: {
            id: true,
            email: true,
            status: true,
            role: true,
            joinedAt: true,
            memberProfile: {
                select: { fullName: true, profilePhotoUrl: true },
            },
        },
        orderBy: { joinedAt: 'asc' },
    });

    wideLogger.addCtx('get_church_admins_result', 'success');
    return res.status(200).json({
        status: 'success',
        superAdmin: church.superAdmin,
        memberAdmins,
    });
});
