import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ChurchRole, type MembershipStatus } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { wideLogger } from '../utils/wideLogger.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CacheService, cacheKeys } from '../utils/cache.js';
import { normalizePhoneToE164 } from '../utils/phone.js';
import type { ChurchRequestInput } from '../schema/church.schema.js';
import type {
    ApproveJoinRequestInput,
    BanUserInput,
    CancelJoinRequestInput,
    JoinRequestInput,
    RejectJoinRequestInput,
    UnbanUserInput,
} from '../schema/church.schema.js';

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

export const createChurchRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'create_church_request');
    const userId = req.user?.id;

    if (!userId || req.user?.accountType !== 'MEMBER') {
        throw new AppError('Only church members can submit church requests.', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);
    const data = req.body as ChurchRequestInput;

    let phoneContact: string | null = null;
    if (data.phoneContact) {
        phoneContact = normalizePhoneToE164(data.phoneContact, data.phoneCountryCode);
        if (!phoneContact) {
            throw new AppError('Invalid phone number.', 400, 'INVALID_PHONE');
        }
    }

    const churchRequest = await prisma.churchRequest.create({
        data: {
            churchName: data.churchName,
            city: data.city,
            leaderName: data.leaderName,
            phoneContact,
            emailContact: data.emailContact || null,
            requestedById: userId,
        },
    });

    wideLogger.addCtx('church_request_id', churchRequest.id);
    return res.status(201).json({
        status: 'success',
        message: 'Church request submitted successfully!',
        churchRequest,
    });
});

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

        // Unaffiliated member (created via Google sign-in without a church) →
        // attach them to this church in place so the Google link is kept.
        if (existing.churchId === null) {
            const member = await prisma.member.update({
                where: { id: existing.id },
                data: { churchId, status: 'PENDING', rejectionReason: null, joinedAt: new Date() },
                include: MEMBER_INCLUDE,
            });

            await CacheService.delete(cacheKeys.userMe(userId));

            wideLogger.addCtx('submit_join_request', 'success');
            return res.status(200).json({
                status: 'success',
                message: 'Join request submitted successfully!',
                member,
            });
        }

        // REJECTED in a different church, or PENDING in a different church →
        // move the existing member record to the new church without deleting
        // it, preserving the Google link and any profile data.
        const member = await prisma.member.update({
            where: { id: existing.id },
            data: {
                churchId,
                status: 'PENDING',
                rejectionReason: null,
                joinedAt: new Date(),
            },
            include: MEMBER_INCLUDE,
        });

        await CacheService.delete(cacheKeys.userMe(userId));

        wideLogger.addCtx('submit_join_request', 'success');
        return res.status(200).json({
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
// Cancelling a pending join request detaches the member from the church they
// applied to. The Member account itself is preserved (it may hold a Google
// link and profile data) — only the church affiliation is removed so the
// member can apply elsewhere.
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
        select: { id: true, churchId: true, status: true },
    });

    if (!member) {
        wideLogger.addCtx('cancel_join_request', 'request_not_found');
        throw new AppError('Member not found!', 404, 'REQUEST_NOT_FOUND');
    }

    if (member.churchId === null || member.status !== 'PENDING') {
        wideLogger.addCtx('cancel_join_request', 'not_pending');
        throw new AppError(
            'Only a pending join request can be cancelled.',
            409,
            'REQUEST_NOT_PENDING',
        );
    }

    const updated = await prisma.member.update({
        where: { id: member.id },
        data: {
            churchId: null,
            status: 'PENDING',
            rejectionReason: null,
        },
        include: MEMBER_INCLUDE,
    });

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('cancel_join_request_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Join request cancelled successfully.',
        member: updated,
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
