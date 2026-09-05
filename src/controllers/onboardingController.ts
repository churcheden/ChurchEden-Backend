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
import { normalizePhoneToE164 } from '../utils/phone.js';
import { completeProfileSchema } from '../schema/onboarding.schema.js';
import { CacheService, cacheKeys } from '../utils/cache.js';
import {
    CHURCH_ONBOARDING_DRAFT_TTL_SECONDS,
    type Step1Input,
    type Step2Input,
    type Step3Input,
    type Step4Input,
    type ChurchOnboardingDraft,
} from '../schema/onboarding.schema.js';
import { PREDEFINED_GROUPS } from '../data/predefinedMinistries.js';
import type { ChurchGroupType } from '@prisma/client';

type CompleteProfileInput = ReturnType<typeof completeProfileSchema.parse>;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
};

const uploadProfilePhoto = async (userId: string, file: Express.Multer.File): Promise<string> => {
    const ext = EXT_BY_MIME[file.mimetype] ?? file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!/^[a-z0-9]{1,8}$/i.test(ext)) {
        throw new AppError('Unsupported image type.', 400, 'INVALID_PHOTO');
    }

    const key = `member-photos/${userId}/${randomUUID()}.${ext}`;

    await cloudflare.send(new PutObjectCommand({
        Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));

    return `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
};

// POST /api/v1/onboarding/complete-profile
export const completeProfile = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'complete_profile');
    const userId = req.user?.id;

    if(!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    if (req.user?.accountType !== 'MEMBER') {
        throw new AppError('Only church members can complete a profile.', 403, 'FORBIDDEN');
    }

    wideLogger.addCtx('user_id', userId);

    const data = req.body as CompleteProfileInput;

    if(req.file) {
        if(!req.file.mimetype.startsWith('image/')) {
            wideLogger.addCtx('complete_profile_result', 'invalid_photo_type');
            throw new AppError('Profile photo must be an image.', 400, 'INVALID_PHOTO');
        };
        if(req.file.size > MAX_PHOTO_BYTES) {
            wideLogger.addCtx('complete_profile_result', 'photo_too_large');
            throw new AppError('Profile photo must be 5MB or smaller.', 400, 'PHOTO_TOO_LARGE');
        };
    }

    const normalizedPhone = normalizePhoneToE164(data.phoneNumber, data.phoneCountryCode);
    if (!normalizedPhone) {
        wideLogger.addCtx('complete_profile_result', 'invalid_phone');
        throw new AppError('Invalid phone number', 400, 'INVALID_PHONE');
    }

    const profilePhotoUrl = req.file
        ? await uploadProfilePhoto(userId, req.file)
        : undefined;

    const profile = await prisma.memberProfile.upsert({
        where: { memberId: userId },
        create: {
            memberId: userId,
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            phoneNumber: normalizedPhone,
            contactEmail: data.contactEmail,
            city: data.city,
            address: data.address,
            maritalStatus: data.maritalStatus,
            occupation: data.occupation ?? null,
            ministry: data.ministry ?? null,
            department: data.department ?? null,
            ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
        },
        update: {
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            phoneNumber: normalizedPhone,
            contactEmail: data.contactEmail,
            city: data.city,
            address: data.address,
            maritalStatus: data.maritalStatus,
            occupation: data.occupation ?? null,
            ministry: data.ministry ?? null,
            department: data.department ?? null,
            ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
        },
    });

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('complete_profile_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Profile completed successfully!',
        profile,
    });
});

// GET /api/v1/onboarding/get-profile
export const getProfile = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_profile');
    const userId = req.user?.id;

    if(!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    wideLogger.addCtx('user_id', userId);

    const profile = await prisma.memberProfile.findUnique({
        where: { memberId: userId },
    });

    if(!profile) {
        wideLogger.addCtx('get_profile_result', 'not_found');
        throw new AppError('Profile not completed yet.', 404, 'PROFILE_NOT_FOUND');
    };

    wideLogger.addCtx('get_profile_result', 'success');
    return res.status(200).json({
        status: 'success',
        profile,
    });
});

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const LOGO_MIME_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
};

const REQUIRED_STEP_1 = ['firstName', 'lastName', 'churchName', 'denomination', 'congregationSize'] as const;
const REQUIRED_STEP_2 = ['country', 'city', 'address', 'phone', 'email', 'primaryLanguage', 'timeZone'] as const;

const getDraftOrThrow = async (superAdminId: string): Promise<ChurchOnboardingDraft> => {
    const draft = await CacheService.get<ChurchOnboardingDraft>(cacheKeys.churchOnboardingDraft(superAdminId));
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

const uploadChurchLogo = async (superAdminId: string, file: Express.Multer.File): Promise<string> => {
    const ext = LOGO_MIME_EXT[file.mimetype];
    if (!ext) {
        throw new AppError('Church logo must be an SVG, PNG or JPG image.', 400, 'INVALID_LOGO');
    }
    if (file.size > MAX_LOGO_BYTES) {
        throw new AppError('Church logo must be 5MB or smaller.', 400, 'LOGO_TOO_LARGE');
    }

    const key = `church-logos/${superAdminId}/${randomUUID()}.${ext}`;

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

    if (!hasOnboardingStep4(draft)) missing.push('step-4');

    return missing;
};

const hasOnboardingStep1 = (draft: ChurchOnboardingDraft): boolean =>
    REQUIRED_STEP_1.every((field) => {
        const value = draft[field as keyof ChurchOnboardingDraft];
        return value !== undefined && value !== null && String(value).trim() !== '';
    });

const hasOnboardingStep2 = (draft: ChurchOnboardingDraft): boolean =>
    REQUIRED_STEP_2.every((field) => {
        const value = draft[field as keyof ChurchOnboardingDraft];
        return value !== undefined && value !== null && String(value).trim() !== '';
    });

const hasOnboardingStep3 = (draft: ChurchOnboardingDraft): boolean =>
    Array.isArray(draft.serviceTimes) && draft.serviceTimes.length > 0;

// Ministries are optional in content, so step-4 counts as complete once it has
// been saved (both keys present in the draft, even if empty arrays).
const hasOnboardingStep4 = (draft: ChurchOnboardingDraft): boolean =>
    Array.isArray(draft.ministryIds) || Array.isArray(draft.departmentIds) || Array.isArray(draft.customGroups);

/**
 * Ensures every step BEFORE `nextStep` is already saved in the cache draft.
 * Returns the first missing step so clients can redirect the user to the
 * earliest incomplete step. This protects against sparse/out-of-order drafts
 * (e.g. step-2 present but step-1 missing).
 */
const requirePriorStep = (draft: ChurchOnboardingDraft, nextStep: 2 | 3 | 4): void => {
    if (nextStep >= 2 && !hasOnboardingStep1(draft)) {
        throw new AppError(
            'Please complete Church Basics before continuing.',
            400,
            'STEP_1_REQUIRED',
        );
    }
    if (nextStep >= 3 && !hasOnboardingStep2(draft)) {
        throw new AppError(
            'Please complete Location & Contact before continuing.',
            400,
            'STEP_2_REQUIRED',
        );
    }
    if (nextStep >= 4 && !hasOnboardingStep3(draft)) {
        throw new AppError(
            'Please complete Service Schedule & Branding before continuing.',
            400,
            'STEP_3_REQUIRED',
        );
    }
};

// PATCH /api/v1/onboarding/save-onboarding-step-1
export const saveOnboardingStep1 = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'save_onboarding_step_1');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);

    const data = req.body as Step1Input;

    const existingName = await prisma.church.findUnique({
        where: {
            name: data.churchName,
        }
    });

    if(existingName){
        throw new AppError('A church with this name already exists!', 400, 'BAD_REQUEST');
    };

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

// PATCH /api/v1/onboarding/save-onboarding-step-2
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

    requirePriorStep(draft, 2);

    const normalizedPhone = parseChurchPhone(data.phone, data.country);
    const merged: ChurchOnboardingDraft = { ...draft, ...data, phone: normalizedPhone };

    await CacheService.set(key, merged, CHURCH_ONBOARDING_DRAFT_TTL_SECONDS);

    wideLogger.addCtx('save_onboarding_step_2', 'success');
    return res.status(200).json({
        status: 'success',
        draft: merged,
    });
});

// PATCH /api/v1/onboarding/save-onboarding-step-3 (multipart/form-data — logo upload)
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

    requirePriorStep(draft, 3);

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

// PATCH /api/v1/onboarding/save-onboarding-step-4
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

    requirePriorStep(draft, 4);

    const merged: ChurchOnboardingDraft = {
        ...draft,
        ministryIds: data.ministryIds,
        departmentIds: data.departmentIds,
        customGroups: data.customGroups ?? [],
    };

    await CacheService.set(key, merged, CHURCH_ONBOARDING_DRAFT_TTL_SECONDS);

    wideLogger.addCtx('save_onboarding_step_4', 'success');
    return res.status(200).json({
        status: 'success',
        draft: merged,
    });
});

// GET /api/v1/onboarding/get-onboarding-draft
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

// POST /api/v1/onboarding/complete-church-onboarding
export const completeChurchOnboarding = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'complete_church_onboarding');
    const superAdminId = req.user?.id;

    if (!superAdminId || req.user?.accountType !== 'ADMIN') {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', superAdminId);

    const existingChurch = await prisma.church.findUnique({ where: { superAdminId } });
    if (existingChurch) {
        await CacheService.delete(cacheKeys.churchOnboardingDraft(superAdminId));
        await CacheService.delete(cacheKeys.userMe(`admin:${superAdminId}`));
        return res.status(200).json({
            status: 'success',
            message: 'Church onboarding already completed.',
            church: existingChurch,
        });
    }
    const key = cacheKeys.churchOnboardingDraft(superAdminId);
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

    const groupById = new Map(PREDEFINED_GROUPS.map((group) => [group.id, group]));
    const invalidMinIds = (draft.ministryIds ?? []).filter((id) => !groupById.has(id));
    const invalidDepIds = (draft.departmentIds ?? []).filter((id) => !groupById.has(id));
    if (invalidMinIds.length > 0 || invalidDepIds.length > 0) {
        wideLogger.addCtx('complete_church_onboarding', 'invalid_group_id');
        throw new AppError('One or more selected groups are not recognized.', 400, 'INVALID_GROUP_ID');
    };

    interface GroupRow {
        name: string;
        type: ChurchGroupType;
        description: string | null;
        icon: string | null;
        isCustom: boolean;
    }

    const resolvedGroups: GroupRow[] = [];
    const takenNames = new Set<string>();

    for (const id of draft.ministryIds ?? []) {
        const predefined = groupById.get(id)!;
        const normalized = predefined.name.toLowerCase();
        if (takenNames.has(normalized)) continue;
        takenNames.add(normalized);
        resolvedGroups.push({
            name: predefined.name,
            type: predefined.type,
            description: predefined.description,
            icon: predefined.icon,
            isCustom: false,
        });
    }

    for (const id of draft.departmentIds ?? []) {
        const predefined = groupById.get(id)!;
        const normalized = predefined.name.toLowerCase();
        if (takenNames.has(normalized)) continue;
        takenNames.add(normalized);
        resolvedGroups.push({
            name: predefined.name,
            type: predefined.type,
            description: predefined.description,
            icon: predefined.icon,
            isCustom: false,
        });
    }

    for (const custom of draft.customGroups ?? []) {
        const normalized = custom.name.toLowerCase();
        if (takenNames.has(normalized)) {
            throw new AppError(
                `"${custom.name}" is already among this church's ministries.`,
                400,
                'DUPLICATE_MINISTRY_NAME',
            );
        }
        takenNames.add(normalized);
        resolvedGroups.push({
            name: custom.name,
            type: custom.type,
            description: custom.description ?? null,
            icon: custom.icon ?? null,
            isCustom: true,
        });
    }

    const fullName = `${draft.firstName} ${draft.lastName}`.trim();

    const church = await prisma.$transaction(async (tx) => {
        // First establish the church with superAdminId.
        const created = await tx.church.create({
            data: {
                superAdminId,
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

        if ((draft.serviceTimes ?? []).length > 0) {
            await tx.serviceTime.createMany({
                data: draft.serviceTimes!.map((serviceTime) => ({
                    churchId: created.id,
                    label: serviceTime.label,
                    dayOfWeek: serviceTime.dayOfWeek,
                    time: serviceTime.time,
                })),
            });
        }

        if (resolvedGroups.length > 0) {
            await tx.churchGroup.createMany({
                data: resolvedGroups.map((ministry) => ({
                    churchId: created.id,
                    name: ministry.name,
                    type: ministry.type,
                    description: ministry.description,
                    icon: ministry.icon,
                    isCustom: ministry.isCustom,
                })),
            });
        }

        // The founding SuperAdmin is the church owner — no separate Admin row needed.
        await tx.superAdmin.update({
            where: { id: superAdminId },
            data: { fullName },
        });

        return created;
    });

    await CacheService.delete(key);
    await CacheService.delete(cacheKeys.userMe(`admin:${superAdminId}`));

    wideLogger.addCtx('complete_church_onboarding', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Church created successfully!',
        church,
    });
});
