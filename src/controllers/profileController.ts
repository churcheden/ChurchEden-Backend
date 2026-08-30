import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { cloudflare } from '../config/cloudflare.js';
import { env } from '../env.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { wideLogger } from '../utils/wideLogger.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { CacheService, cacheKeys } from '../utils/cache.js';
import { completeProfileSchema } from '../schema/profile.schema.js';

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

// POST /api/v1/members/profile/complete
export const completeProfile = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'complete_profile');
    const userId = req.user?.id;

    if(!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

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

    const parsedPhone = parsePhoneNumberFromString(data.phoneNumber);
    if(!parsedPhone || !parsedPhone.isValid()) {
        wideLogger.addCtx('complete_profile_result', 'invalid_phone');
        throw new AppError('Invalid phone number', 400, 'INVALID_PHONE');
    };
    const normalizedPhone = parsedPhone.format('E.164');

    const profilePhotoUrl = req.file
        ? await uploadProfilePhoto(userId, req.file)
        : undefined;

    const profile = await prisma.memberProfile.upsert({
        where: { userId },
        create: {
            userId,
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            phoneNumber: normalizedPhone,
            contactEmail: data.contactEmail,
            city: data.city,
            address: data.address,
            maritalStatus: data.maritalStatus,
            occupation: data.occupation ?? null,
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
            ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
        },
    });

    await prisma.user.update({
        where: { id: userId },
        data: { fullName: data.fullName },
    });

    await CacheService.delete(cacheKeys.userMe(userId));

    wideLogger.addCtx('complete_profile_result', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Profile completed successfully!',
        profile,
    });
});

// GET /api/v1/members/profile
export const getProfile = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'get_profile');
    const userId = req.user?.id;

    if(!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    wideLogger.addCtx('user_id', userId);

    const profile = await prisma.memberProfile.findUnique({
        where: { userId },
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