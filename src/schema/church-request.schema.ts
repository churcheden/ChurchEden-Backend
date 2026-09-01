import { z } from 'zod';

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