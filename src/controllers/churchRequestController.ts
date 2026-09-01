import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { wideLogger } from '../utils/wideLogger.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { normalizePhoneToE164 } from '../utils/phone.js';
import type { ChurchRequestInput } from '../schema/church-request.schema.js';

export const createChurchRequest = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    wideLogger.addCtx('action', 'create_church_request');
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    wideLogger.addCtx('user_id', userId);
    const data = req.body as ChurchRequestInput;

    let phoneContact: string | null = null;
    if (data.phoneContact) {
        // Normalize to E.164 using the country code when provided, so local
        // ("0544053900") and international ("+233 ...") formats are accepted.
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