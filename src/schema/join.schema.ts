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

export const joinRequestsQuerySchema = z.object({
    status: z.nativeEnum(MembershipStatus).optional(),
    churchId: z.uuid('Invalid church id').optional(),
});

export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type ApproveJoinRequestInput = z.infer<typeof approveJoinRequestSchema>;
export type RejectJoinRequestInput = z.infer<typeof rejectJoinRequestSchema>;