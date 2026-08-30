import { z } from 'zod';

export const completeProfileSchema = z.object({
    fullName: z.string().trim().min(1).max(120),
    dateOfBirth: z.coerce.date().max(new Date(), { message: 'Date of birth cannot be in the future' }),
    gender: z.enum(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']),
    phoneNumber: z.string(),
    contactEmail: z.email("Invalid email address!").max(255),
    city: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(255),
    maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'PREFER_NOT_TO_SAY']),
    occupation: z.string().trim().max(100).optional(),
});