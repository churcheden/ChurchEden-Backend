import { z } from 'zod';
import { MembershipStatus } from '@prisma/client';

export const joinRequestSchema = z.object({
    churchId: z.uuid('Invalid church id'),
});

export const approveJoinRequestSchema = z.object({
    membershipId: z.uuid('Invalid membership id'),
});

export const rejectJoinRequestSchema = z.object({
    membershipId: z.uuid('Invalid membership id'),
    rejectionReason: z.string().trim().max(500, 'Rejection reason must be 500 characters or less.').optional(),
});

export const banUserSchema = z.object({
    membershipId: z.uuid('Invalid membership id'),
    banReason: z.string().trim().min(1, 'Ban reason is required.').max(500, 'Ban reason must be 500 characters or less.'),
});

export const unbanUserSchema = z.object({
    membershipId: z.uuid('Invalid membership id'),
});

export const joinRequestsQuerySchema = z.object({
    status: z.nativeEnum(MembershipStatus).optional(),
    churchId: z.uuid('Invalid church id').optional(),
});

export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type ApproveJoinRequestInput = z.infer<typeof approveJoinRequestSchema>;
export type RejectJoinRequestInput = z.infer<typeof rejectJoinRequestSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
export type UnbanUserInput = z.infer<typeof unbanUserSchema>;