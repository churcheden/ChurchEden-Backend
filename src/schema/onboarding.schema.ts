import { z } from 'zod';
import { CongregationSize, ChurchLanguage } from '@prisma/client';

export const CHURCH_ONBOARDING_DRAFT_TTL_SECONDS = 86400;

const IANA_TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

export const step1Schema = z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    churchName: z.string().trim().min(1).max(150),
    denomination: z.string().trim().min(1).max(100),
    congregationSize: z.nativeEnum(CongregationSize),
    foundedYear: z.coerce.number().int().min(1500).max(new Date().getFullYear()).optional(),
});

export const step2Schema = z.object({
    country: z.string().trim().min(1),
    city: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(255),
    phone: z.string().trim().min(1),
    email: z.email('Invalid church email address!').max(255),
    primaryLanguage: z.nativeEnum(ChurchLanguage),
    timeZone: z.string().trim().refine((tz) => IANA_TIME_ZONES.has(tz), {
        message: 'Invalid IANA time zone',
    }),
});

export const serviceTimeSchema = z.object({
    label: z.string().trim().min(1).max(60),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in 24h HH:MM format'),
});

export const step3Schema = z.object({
    serviceTimes: z.preprocess(
        (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return value;
        },
        z.array(serviceTimeSchema).min(1, 'At least one service time is required'),
    ),
});

export const customMinistrySchema = z.object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(['MINISTRY', 'DEPARTMENT']),
    description: z.string().trim().max(255).optional(),
    icon: z.string().optional(),
});

export const step4Schema = z.object({
    ministryIds: z.array(z.uuid('Invalid ministry id')).default([]),
    customMinistries: z.array(customMinistrySchema).default([]),
});

export type Step1Input = z.infer<typeof step1Schema>;
export type Step2Input = z.infer<typeof step2Schema>;
export type Step3Input = z.infer<typeof step3Schema>;
export type Step4Input = z.infer<typeof step4Schema>;

export interface ChurchServiceTimeDraft {
    label: string;
    dayOfWeek: number;
    time: string;
}

export interface ChurchCustomMinistryDraft {
    name: string;
    type: 'MINISTRY' | 'DEPARTMENT';
    description?: string | undefined;
    icon?: string | undefined;
}

export interface ChurchOnboardingDraft {
    firstName?: string;
    lastName?: string;
    churchName?: string;
    denomination?: string;
    congregationSize?: CongregationSize;
    foundedYear?: number | undefined;
    country?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    primaryLanguage?: ChurchLanguage;
    timeZone?: string;
    serviceTimes?: ChurchServiceTimeDraft[];
    logoUrl?: string;
    ministryIds?: string[];
    customMinistries?: ChurchCustomMinistryDraft[];
}