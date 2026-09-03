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
    CancelJoinRequestInput,
    JoinRequestInput,
    RejectJoinRequestInput,
    UnbanUserInput,
} from '../schema/join.schema.js';

// The church the authenticated SuperAdmin manages — via Church.superAdminId.
const getManagedChurchId = async (superAdminId: string): Promise<string | null> => {
    const church = await prisma.church.findUnique({
        where: { superAdminId },
        select: { id: true },
    });
    return church?.id ?? null;
};

const MEMBER_INCLUDE = {
    memberProfile: {
        select: {
            profilePhotoUrl: true,
            fullName: true,
            contactEmail: true,
            phoneNumber: true,
            city: true,
        },
    },
    church: {
        select: { id: true, name: true, logoUrl: true },
    },
};

// POST /api/v1/join-requests
// A member requests to join a church. The Member record is created here
// (with email from the JWT, churchId from the request body). Existing
// REJECTED rows are reset to PENDING so the member can re-apply.
export const submitJoinRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'submit_join_request');
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
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

    // Check if a Member record already exists for this email (email is unique).
    const existing = await prisma.member.findUnique({
        where: { email: userEmail },
        select: { id: true, churchId: true, status: true, isBanned: true, banReason: true },
    });

    if (existing) {
        if (existing.isBanned) {
            wideLogger.addCtx('submit_join_request', 'banned');
            throw new AppError(
                'You are banned from joining this church.',
                403,
                'BANNED_FROM_CHURCH',
            );
        }

        if (existing.churchId === churchId && existing.status === 'APPROVED') {
            wideLogger.addCtx('submit_join_request', 'already_member');
            throw new AppError('You are already a member of this church.', 409, 'ALREADY_MEMBER');
        }

        if (existing.churchId === churchId && existing.status === 'PENDING') {
            wideLogger.addCtx('submit_join_request', 'already_pending');
            throw new AppError('You already have a pending request to join this church.', 409, 'ALREADY_PENDING');
        }

        // If the member is in a different church, they must leave first.
        if (existing.churchId !== churchId && existing.status === 'APPROVED') {
            throw new AppError(
                'You are already a member of another church. Please leave your current church first.',
                409,
                'ALREADY_MEMBER_ANOTHER_CHURCH',
            );
        }

        // REJECTED or PENDING in a different church → update to new church
        let member;
        let created = false;

        if (existing.status === 'REJECTED' && existing.churchId === churchId) {
            member = await prisma.member.update({
                where: { id: existing.id },
                data: { status: 'PENDING', rejectionReason: null, churchId, joinedAt: new Date() },
                include: MEMBER_INCLUDE,
            });
        } else {
            // Delete old record and create new one for different church
            await prisma.member.delete({ where: { id: existing.id } });
            created = true;
            member = await prisma.member.create({
                data: { email: userEmail, churchId, isVerified: true },
                include: MEMBER_INCLUDE,
            });
        }

        await CacheService.delete(cacheKeys.userMe(userId));

        wideLogger.addCtx('submit_join_request', 'success');
        return res.status(created ? 201 : 200).json({
            status: 'success',
            message: 'Join request submitted successfully!',
            member,
        });
    }

    // New member — create Member record with churchId
    const member = await prisma.member.create({
        data: {
            email: userEmail,
            churchId,
        },
        include: MEMBER_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('submit_join_request', 'success');
    return res.status(201).json({
        status: 'success',
        message: 'Join request submitted successfully!',
        member,
    });
});

// POST /api/v1/join-requests/cancel
export const cancelJoinRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'cancel_join_request');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    if (req.user?.accountType !== 'MEMBER') {
        throw new AppError('Only church members can cancel join requests.', 403, 'FORBIDDEN');
    }

    wideLogger.addCtx('user_id', userId);

    const member = await prisma.member.findUnique({
        where: { id: userId },
        select: { id: true, status: true },
    });

    if (!member) {
        wideLogger.addCtx('cancel_join_request', 'request_not_found');
        throw new AppError('Member not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (member.status !== 'PENDING') {
        wideLogger.addCtx('cancel_join_request', 'not_pending');
        throw new AppError(
            'Only a pending join request can be cancelled.',
            409,
            'REQUEST_NOT_PENDING',
        );
    }

    await prisma.member.delete({ where: { id: member.id } });

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('cancel_join_request_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Join request cancelled successfully.',
    });
});

// GET /api/v1/join-requests
// Admin-only. Lists join requests (Members with PENDING status) across the
// church the SuperAdmin administers.
export const getJoinRequests = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_join_requests');
    if (req.user?.accountType !== 'ADMIN' || !req.user.id) {
        throw new AppError('You need to be a church administrator to view join requests.', 403, 'FORBIDDEN');
    }
    const adminId = req.user.id;
    wideLogger.addCtx('admin_id', adminId);

    const managedId = await getManagedChurchId(adminId);

    if (!managedId) {
        wideLogger.addCtx('get_join_requests', 'not_admin');
        throw new AppError('You need to be a church administrator to view join requests.', 403, 'FORBIDDEN');
    }

    const query = req.query as { status?: MembershipStatus; churchId?: string };

    if (query.churchId && query.churchId !== managedId) {
        wideLogger.addCtx('get_join_requests', 'church_forbidden');
        throw new AppError('You do not have permission to view join requests for this church.', 403, 'FORBIDDEN');
    }

    const status = query.status || 'PENDING';

    const requests = await prisma.member.findMany({
        where: {
            churchId: managedId,
            status,
        },
        include: MEMBER_INCLUDE,
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

    const member = await prisma.member.findUnique({
        where: { id: membershipId },
        select: { id: true, status: true },
    });

    if (!member) {
        wideLogger.addCtx('approve_join_request', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (member.status === 'APPROVED') {
        wideLogger.addCtx('approve_join_request', 'already_approved');
        return res.status(200).json({
            status: 'success',
            message: 'This request has already been approved.',
        });
    }

    const updated = await prisma.member.update({
        where: { id: member.id },
        data: { status: 'APPROVED', rejectionReason: null },
        include: MEMBER_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(member.id));

    wideLogger.addCtx('approve_join_request', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Join request approved successfully!',
        member: updated,
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

    const member = await prisma.member.findUnique({
        where: { id: input.membershipId },
        select: { id: true, status: true },
    });

    if (!member) {
        wideLogger.addCtx('reject_join_request', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    const rejectionReason = input.rejectionReason?.trim() || null;

    const updated = await prisma.member.update({
        where: { id: member.id },
        data: { status: 'REJECTED', rejectionReason },
        include: MEMBER_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(member.id));

    wideLogger.addCtx('reject_join_request', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Join request rejected.',
        member: updated,
    });
});

// POST /api/v1/join-requests/ban
export const banUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'ban_user');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const input = req.body as BanUserInput;

    const member = await prisma.member.findUnique({
        where: { id: input.membershipId },
        select: { id: true, status: true, isBanned: true },
    });

    if (!member) {
        wideLogger.addCtx('ban_user', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (member.isBanned) {
        wideLogger.addCtx('ban_user', 'already_banned');
        return res.status(200).json({
            status: 'success',
            message: 'This user is already banned.',
        });
    }

    const banReason = input.banReason?.trim() || null;

    const updated = await prisma.member.update({
        where: { id: member.id },
        data: {
            isBanned: true,
            status: 'REJECTED',
            bannedAt: new Date(),
            banReason,
        },
        include: MEMBER_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(member.id));

    wideLogger.addCtx('ban_user', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'User banned from this church.',
        member: updated,
    });
});

// POST /api/v1/join-requests/unban
export const unbanUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'unban_user');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const input = req.body as UnbanUserInput;

    const member = await prisma.member.findUnique({
        where: { id: input.membershipId },
        select: { id: true, status: true, isBanned: true },
    });

    if (!member) {
        wideLogger.addCtx('unban_user', 'request_not_found');
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (!member.isBanned) {
        wideLogger.addCtx('unban_user', 'not_banned');
        return res.status(200).json({
            status: 'success',
            message: 'This user is not banned.',
        });
    }

    const updated = await prisma.member.update({
        where: { id: member.id },
        data: {
            isBanned: false,
            bannedAt: null,
            banReason: null,
        },
        include: MEMBER_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(member.id));

    wideLogger.addCtx('unban_user', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'User unbanned from this church.',
        member: updated,
    });
});
