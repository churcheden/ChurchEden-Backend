import type { Response } from 'express';
import { ChurchRole, type MembershipStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { wideLogger } from '../utils/wideLogger.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { CacheService, cacheKeys } from '../utils/cache.js';
import type {
    ApproveJoinRequestInput,
    BanUserInput,
    JoinRequestInput,
    RejectJoinRequestInput,
    UnbanUserInput,
} from '../schema/join.schema.js';

const ADMIN_ROLES: ChurchRole[] = [ChurchRole.ADMIN, ChurchRole.SUPER_ADMIN];

// The churches the authenticated account administers — now sourced from the
// Admin table, since admin privileges no longer live on ChurchMembership.
const getManagedChurchIds = async (adminId: string): Promise<string[]> => {
    const admins = await prisma.admin.findMany({
        where: { id: adminId, isActive: true },
        select: { churchId: true },
    });
    return admins.map((a) => a.churchId);
};

const MEMBERSHIP_INCLUDE = {
    user: {
        select: {
            id: true,
            email: true,
            fullName: true,
            memberProfile: {
                select: {
                    profilePhotoUrl: true,
                    fullName: true,
                    contactEmail: true,
                    phoneNumber: true,
                    city: true,
                },
            },
        },
    },
    church: {
        select: { id: true, name: true, logoUrl: true },
    },
};

// POST /api/v1/join-requests
// A member requests to join a church. Existing REJECTED rows are reset to PENDING
// so the member can re-apply without creating a duplicate membership row.
export const submitJoinRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'submit_join_request');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const { churchId } = req.body as JoinRequestInput;

    const church = await prisma.church.findUnique({
        where: { id: churchId },
        select: { id: true },
    });

    if (!church) {
        wideLogger.addCtx('submit_join_request', 'church_not_found');
        throw new AppError('Church not found!', 404, 'CHURCH_NOT_FOUND');
    }

    const existing = await prisma.churchMembership.findUnique({
        where: { userId_churchId: { userId, churchId } },
        select: { id: true, status: true, isBanned: true, banReason: true },
    });

    if (existing?.isBanned) {
        wideLogger.addCtx('submit_join_request', 'banned');
        throw new AppError(
            'You are banned from joining this church.',
            403,
            'BANNED_FROM_CHURCH',
        );
    }

    if (existing?.status === 'APPROVED') {
        wideLogger.addCtx('submit_join_request', 'already_member');
        throw new AppError('You are already a member of this church.', 409, 'ALREADY_MEMBER');
    }

    if (existing?.status === 'PENDING') {
        wideLogger.addCtx('submit_join_request', 'already_pending');
        throw new AppError('You already have a pending request to join this church.', 409, 'ALREADY_PENDING');
    }

    let membership;
    let created = false;

    if (existing) {
        // REJECTED → the member is re-applying
        membership = await prisma.churchMembership.update({
            where: { id: existing.id },
            data: { status: 'PENDING', rejectionReason: null, joinedAt: new Date() },
            include: MEMBERSHIP_INCLUDE,
        });
    } else {
        created = true;
        membership = await prisma.churchMembership.create({
            data: { userId, churchId },
            include: MEMBERSHIP_INCLUDE,
        });
    }

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('submit_join_request', 'success');
    return res.status(created ? 201 : 200).json({
        status: 'success',
        message: 'Join request submitted successfully!',
        membership,
    });
});

// GET /api/v1/join-requests
// Admin-only. Lists join requests across all churches the requester administers;
// an optional ?churchId= narrows the list to a single church they administer.
export const getJoinRequests = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_join_requests');
    if (req.user?.accountType !== 'ADMIN' || !req.user.id) {
        throw new AppError('You need to be a church administrator to view join requests.', 403, 'FORBIDDEN');
    }
    const adminId = req.user.id;
    wideLogger.addCtx('admin_id', adminId);

    const managedIds = await getManagedChurchIds(adminId);

    if (managedIds.length === 0) {
        wideLogger.addCtx('get_join_requests', 'not_admin');
        throw new AppError('You need to be a church administrator to view join requests.', 403, 'FORBIDDEN');
    }

    const query = req.query as { status?: MembershipStatus; churchId?: string };

    if (query.churchId && !managedIds.includes(query.churchId)) {
        wideLogger.addCtx('get_join_requests', 'church_forbidden');
        throw new AppError('You do not have permission to view join requests for this church.', 403, 'FORBIDDEN');
    }

    const status = query.status || 'PENDING';

    const requests = await prisma.churchMembership.findMany({
        where: {
            churchId: query.churchId ?? { in: managedIds },
            status,
        },
        include: MEMBERSHIP_INCLUDE,
        orderBy: { joinedAt: 'desc' },
    });

    wideLogger.addCtx('get_join_requests', 'success');
    return res.status(200).json({
        status: 'success',
        requests,
    });
});

// POST /api/v1/join-requests/approve
export const approveJoinRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'approve_join_request');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const { membershipId } = req.body as ApproveJoinRequestInput;

    const membership = await prisma.churchMembership.findUnique({
        where: { id: membershipId },
        select: { id: true, userId: true, status: true },
    });

    if (!membership) {
        wideLogger.addCtx('approve_join_request', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (membership.status === 'APPROVED') {
        // Idempotent — safe against double-clicks
        wideLogger.addCtx('approve_join_request', 'already_approved');
        return res.status(200).json({
            status: 'success',
            message: 'This request has already been approved.',
        });
    }

    const updated = await prisma.churchMembership.update({
        where: { id: membership.id },
        data: { status: 'APPROVED', rejectionReason: null, reviewedBy: userId, reviewedAt: new Date() },
        include: MEMBERSHIP_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(membership.userId));

    wideLogger.addCtx('approve_join_request', 'success');
    wideLogger.addCtx('approve_requester_id', membership.userId);
    return res.status(200).json({
        status: 'success',
        message: 'Join request approved successfully!',
        membership: updated,
    });
});

// POST /api/v1/join-requests/reject
export const rejectJoinRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'reject_join_request');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const input = req.body as RejectJoinRequestInput;

    const membership = await prisma.churchMembership.findUnique({
        where: { id: input.membershipId },
        select: { id: true, userId: true, status: true },
    });

    if (!membership) {
        wideLogger.addCtx('reject_join_request', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    const rejectionReason = input.rejectionReason?.trim() || null;

    const updated = await prisma.churchMembership.update({
        where: { id: membership.id },
        data: { status: 'REJECTED', rejectionReason, reviewedBy: userId, reviewedAt: new Date() },
        include: MEMBERSHIP_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(membership.userId));

    wideLogger.addCtx('reject_join_request', 'success');
    wideLogger.addCtx('reject_requester_id', membership.userId);
    return res.status(200).json({
        status: 'success',
        message: 'Join request rejected.',
        membership: updated,
    });
});

// POST /api/v1/join-requests/ban
// Admins use this to stop a member who keeps re-applying after repeated rejections.
export const banUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'ban_user');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const input = req.body as BanUserInput;

    const membership = await prisma.churchMembership.findUnique({
        where: { id: input.membershipId },
        select: { id: true, userId: true, status: true, isBanned: true },
    });

    if (!membership) {
        wideLogger.addCtx('ban_user', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (membership.isBanned) {
        wideLogger.addCtx('ban_user', 'already_banned');
        return res.status(200).json({
            status: 'success',
            message: 'This user is already banned.',
        });
    }

    const banReason = input.banReason?.trim() || null;

    const updated = await prisma.churchMembership.update({
        where: { id: membership.id },
        data: {
            isBanned: true,
            status: 'REJECTED',
            bannedAt: new Date(),
            banReason,
            reviewedBy: userId,
            reviewedAt: new Date(),
        },
        include: MEMBERSHIP_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(membership.userId));

    wideLogger.addCtx('ban_user', 'success');
    wideLogger.addCtx('ban_requester_id', membership.userId);
    return res.status(200).json({
        status: 'success',
        message: 'User banned from this church.',
        membership: updated,
    });
});

// POST /api/v1/join-requests/unban
// Reverses a ban so the user can submit join requests again.
export const unbanUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'unban_user');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const input = req.body as UnbanUserInput;

    const membership = await prisma.churchMembership.findUnique({
        where: { id: input.membershipId },
        select: { id: true, userId: true, status: true, isBanned: true },
    });

    if (!membership) {
        wideLogger.addCtx('unban_user', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (!membership.isBanned) {
        wideLogger.addCtx('unban_user', 'not_banned');
        return res.status(200).json({
            status: 'success',
            message: 'This user is not banned.',
        });
    }

    const updated = await prisma.churchMembership.update({
        where: { id: membership.id },
        data: {
            isBanned: false,
            bannedAt: null,
            banReason: null,
        },
        include: MEMBERSHIP_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(membership.userId));

    wideLogger.addCtx('unban_user', 'success');
    wideLogger.addCtx('unban_requester_id', membership.userId);
    return res.status(200).json({
        status: 'success',
        message: 'User unbanned from this church.',
        membership: updated,
    });
});