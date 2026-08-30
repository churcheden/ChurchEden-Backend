import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { cloudflare } from '../config/cloudflare.js';
import { env } from '../env.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { wideLogger } from '../utils/wideLogger.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { CacheService, cacheKeys } from '../utils/cache.js';
import {
    CHURCH_ONBOARDING_DRAFT_TTL_SECONDS,
    type Step1Input,
    type Step2Input,
    type Step3Input,
    type Step4Input,
    type ChurchOnboardingDraft,
} from '../schema/onboarding.schema.js';
import { PREDEFINED_MINISTRIES } from '../data/predefinedMinistries.js';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const LOGO_MIME_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
};

const REQUIRED_STEP_1 = ['firstName', 'lastName', 'churchName', 'denomination', 'congregationSize'] as const;
const REQUIRED_STEP_2 = ['country', 'city', 'address', 'phone', 'email', 'primaryLanguage', 'timeZone'] as const;

const getDraftOrThrow = async (userId: string): Promise<ChurchOnboardingDraft> => {
    const draft = await CacheService.get<ChurchOnboardingDraft>(cacheKeys.churchOnboardingDraft(userId));
    if (!draft) {
        throw new AppError('No church onboarding draft found. Please start from Step 1.', 404, 'DRAFT_NOT_FOUND');
    }
    return draft;
};

const parseChurchPhone = (phone: string, country: string): string => {
    let parsed;
    try {
        parsed = parsePhoneNumberFromString(phone, country as CountryCode);
    } catch {
        throw new AppError('Invalid phone number.', 400, 'INVALID_PHONE');
    }
    if (!parsed || !parsed.isValid()) {
        throw new AppError('Invalid phone number.', 400, 'INVALID_PHONE');
    }
    return parsed.format('E.164');
};

const uploadChurchLogo = async (userId: string, file: Express.Multer.File): Promise<string> => {
    const ext = LOGO_MIME_EXT[file.mimetype];
    if (!ext) {
        throw new AppError('Church logo must be an SVG, PNG or JPG image.', 400, 'INVALID_LOGO');
    }
    if (file.size > MAX_LOGO_BYTES) {
        throw new AppError('Church logo must be 5MB or smaller.', 400, 'LOGO_TOO_LARGE');
    }

    const key = `church-logos/${userId}/${randomUUID()}.${ext}`;

    await cloudflare.send(new PutObjectCommand({
        Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));

    return `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
};

const findIncompleteSteps = (draft: ChurchOnboardingDraft): string[] => {
    const missing: string[] = [];

    const isEmpty = (value: unknown): boolean =>
        value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

    const missingStep1 = REQUIRED_STEP_1.filter((field) => isEmpty(draft[field]));
    if (missingStep1.length > 0) missing.push('step-1');

    const missingStep2 = REQUIRED_STEP_2.filter((field) => isEmpty(draft[field]));
    if (missingStep2.length > 0) missing.push('step-2');

    if (!Array.isArray(draft.serviceTimes) || draft.serviceTimes.length === 0) missing.push('step-3');

    return missing;
};

// PATCH /api/v1/onboarding/church/step-1
export const saveOnboardingStep1 = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'save_onboarding_step_1');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const data = req.body as Step1Input;
    const key = cacheKeys.churchOnboardingDraft(userId);
    const existing = await CacheService.get<ChurchOnboardingDraft>(key);
    const draft: ChurchOnboardingDraft = { ...(existing ?? {}), ...data };

    await CacheService.set(key, draft, CHURCH_ONBOARDING_DRAFT_TTL_SECONDS);

    wideLogger.addCtx('save_onboarding_step_1', 'success');
    return res.status(200).json({
        status: 'success',
        draft,
    });
});

// PATCH /api/v1/onboarding/church/step-2
export const saveOnboardingStep2 = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'save_onboarding_step_2');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const data = req.body as Step2Input;
    const key = cacheKeys.churchOnboardingDraft(userId);
    const draft = await getDraftOrThrow(userId);

    const normalizedPhone = parseChurchPhone(data.phone, data.country);
    const merged: ChurchOnboardingDraft = { ...draft, ...data, phone: normalizedPhone };

    await CacheService.set(key, merged, CHURCH_ONBOARDING_DRAFT_TTL_SECONDS);

    wideLogger.addCtx('save_onboarding_step_2', 'success');
    return res.status(200).json({
        status: 'success',
        draft: merged,
    });
});

// PATCH /api/v1/onboarding/church/step-3 (multipart/form-data — logo upload)
export const saveOnboardingStep3 = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'save_onboarding_step_3');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const data = req.body as Step3Input;
    const key = cacheKeys.churchOnboardingDraft(userId);
    const draft = await getDraftOrThrow(userId);

    const merged: ChurchOnboardingDraft = {
        ...draft,
        serviceTimes: data.serviceTimes,
    };

    if (req.file) {
        merged.logoUrl = await uploadChurchLogo(userId, req.file);
    }

    await CacheService.set(key, merged, CHURCH_ONBOARDING_DRAFT_TTL_SECONDS);

    wideLogger.addCtx('save_onboarding_step_3', 'success');
    return res.status(200).json({
        status: 'success',
        draft: merged,
    });
});

// PATCH /api/v1/onboarding/church/step-4
export const saveOnboardingStep4 = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'save_onboarding_step_4');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const data = req.body as Step4Input;
    const key = cacheKeys.churchOnboardingDraft(userId);
    const draft = await getDraftOrThrow(userId);

    const merged: ChurchOnboardingDraft = {
        ...draft,
        ministryIds: data.ministryIds,
        customMinistries: data.customMinistries,
    };

    await CacheService.set(key, merged, CHURCH_ONBOARDING_DRAFT_TTL_SECONDS);

    wideLogger.addCtx('save_onboarding_step_4', 'success');
    return res.status(200).json({
        status: 'success',
        draft: merged,
    });
});

// GET /api/v1/onboarding/church/draft
export const getOnboardingDraft = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_onboarding_draft');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const key = cacheKeys.churchOnboardingDraft(userId);
    const draft = await CacheService.get<ChurchOnboardingDraft>(key);

    wideLogger.addCtx('get_onboarding_draft', 'success');
    return res.status(200).json({
        status: 'success',
        draft: draft ?? {},
    });
});

// POST /api/v1/onboarding/church/complete
export const completeChurchOnboarding = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'complete_church_onboarding');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const key = cacheKeys.churchOnboardingDraft(userId);
    const draft = await CacheService.get<ChurchOnboardingDraft>(key);

    if (!draft) {
        throw new AppError('No church onboarding draft found. Please start from Step 1.', 404, 'DRAFT_NOT_FOUND');
    }

    const incompleteSteps = findIncompleteSteps(draft);
    if (incompleteSteps.length > 0) {
        throw new AppError(
            `Incomplete onboarding. Please complete: ${incompleteSteps.join(', ')}.`,
            400,
            'INCOMPLETE_ONBOARDING',
        );
    }

    const ministryById = new Map(PREDEFINED_MINISTRIES.map((ministry) => [ministry.id, ministry]));
    const invalidIds = (draft.ministryIds ?? []).filter((id) => !ministryById.has(id));
    if (invalidIds.length > 0) {
        wideLogger.addCtx('complete_church_onboarding', 'invalid_ministry_id');
        throw new AppError('One or more selected ministries are not recognized.', 400, 'INVALID_MINISTRY_ID');
    }

    interface MinistryRow {
        name: string;
        type: 'MINISTRY' | 'DEPARTMENT';
        description: string | null;
        icon: string | null;
        isCustom: boolean;
    }

    const resolvedMinistries: MinistryRow[] = [];
    const takenNames = new Set<string>();

    for (const id of draft.ministryIds ?? []) {
        const predefined = ministryById.get(id)!;
        const normalized = predefined.name.toLowerCase();
        if (takenNames.has(normalized)) continue;
        takenNames.add(normalized);
        resolvedMinistries.push({
            name: predefined.name,
            type: predefined.type,
            description: predefined.description,
            icon: predefined.icon,
            isCustom: false,
        });
    }

    for (const custom of draft.customMinistries ?? []) {
        const normalized = custom.name.toLowerCase();
        if (takenNames.has(normalized)) {
            throw new AppError(
                `"${custom.name}" is already among this church's ministries.`,
                400,
                'DUPLICATE_MINISTRY_NAME',
            );
        }
        takenNames.add(normalized);
        resolvedMinistries.push({
            name: custom.name,
            type: custom.type,
            description: custom.description ?? null,
            icon: custom.icon ?? null,
            isCustom: true,
        });
    }

    const fullName = `${draft.firstName} ${draft.lastName}`.trim();

    const { church, membership } = await prisma.$transaction(async (tx) => {
        const church = await tx.church.create({
            data: {
                name: draft.churchName!,
                denomination: draft.denomination!,
                congregationSize: draft.congregationSize!,
                foundedYear: draft.foundedYear ?? null,
                country: draft.country!,
                city: draft.city!,
                address: draft.address!,
                phone: draft.phone!,
                email: draft.email!,
                primaryLanguage: draft.primaryLanguage!,
                timeZone: draft.timeZone!,
                logoUrl: draft.logoUrl ?? null,
            },
        });

        if (draft.serviceTimes!.length > 0) {
            await tx.serviceTime.createMany({
                data: draft.serviceTimes!.map((serviceTime) => ({
                    churchId: church.id,
                    label: serviceTime.label,
                    dayOfWeek: serviceTime.dayOfWeek,
                    time: serviceTime.time,
                })),
            });
        }

        if (resolvedMinistries.length > 0) {
            await tx.churchMinistry.createMany({
                data: resolvedMinistries.map((ministry) => ({
                    churchId: church.id,
                    name: ministry.name,
                    type: ministry.type,
                    description: ministry.description,
                    icon: ministry.icon,
                    isCustom: ministry.isCustom,
                })),
            });
        }

        const membership = await tx.churchMembership.create({
            data: {
                userId,
                churchId: church.id,
                role: 'SUPER_ADMIN',
                status: 'APPROVED',
            },
        });

        await tx.user.update({
            where: { id: userId },
            data: { fullName },
        });

        return { church, membership };
    });

    await CacheService.delete(key);
    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('complete_church_onboarding', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Church created successfully!',
        church,
        membership,
    });
});