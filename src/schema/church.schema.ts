import { z } from 'zod';
import { MembershipStatus } from '@prisma/client';

export const churchRequestSchema = z.object({
    churchName: z.string().trim().min(1, 'Church name is required').max(150),
    city: z.string().trim().min(1, 'City is required').max(100),
    leaderName: z.string().trim().min(1, 'Leader name is required').max(100),
    phoneContact: z.string().trim().max(20).optional(),
    phoneCountryCode: z.string().trim().min(2).max(2).uppercase().optional(),
    emailContact: z.string().email('Invalid email address').max(255).optional(),
}).refine(
    (data) => {
        const hasPhone = !!data.phoneContact && data.phoneContact.length > 0;
        const hasEmail = !!data.emailContact && data.emailContact.length > 0;
        return hasPhone !== hasEmail; // XOR: exactly one must be present
    },
    { message: 'Provide either a phone number or an email — not both, and not neither.', path: ['phoneContact'] }
);

export type ChurchRequestInput = z.infer<typeof churchRequestSchema>;

export const churchGroupsSchema = z.object({
    churchId: z.uuid('Invalid church id'),
});

export const searchChurchSchema = z.object({
    name: z.string(),
});

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
    banReason: z.string().trim().min(1, 'A ban reason is required.').max(500, 'Ban reason must be 500 characters or less.'),
});

export const unbanUserSchema = z.object({
    membershipId: z.uuid('Invalid membership id'),
});

// A member withdrawing their own PENDING join request so it stops showing on
// the church admin dashboard before they apply to a different church.
export const cancelJoinRequestSchema = z.object({
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
export type CancelJoinRequestInput = z.infer<typeof cancelJoinRequestSchema>;