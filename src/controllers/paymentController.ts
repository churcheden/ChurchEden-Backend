import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { wideLogger } from "../utils/wideLogger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { paymentService } from "../services/payment.service.js";

export const initializePayment = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    const superAdminId = req.user?.id;

    if(!superAdminId || req.user?.accountType !== 'ADMIN') {
        wideLogger.addCtx('action', 'initialize_payment_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    const superAdmin = await prisma.superAdmin.findUnique({
        where: { id: superAdminId },
        select: {
            id: true,
            email: true,
            church: { select: { id: true, plan: true } },
        },
    });

    if(!superAdmin) {
        wideLogger.addCtx('initialize_payment', 'user_not_found');
        throw new AppError('Admin not found!', 404, 'USER_NOT_FOUND');
    };

    if (superAdmin.church?.plan && superAdmin.church.plan !== 'EXPLORER') {
        throw new AppError('You already have an active subscription!', 409, 'ALREADY_PREMIUM');
    }

    const { authorizationUrl } = await paymentService.initializePayment({
        superAdminId: superAdmin.id,
        email: superAdmin.email,
    });

    wideLogger.addCtx('initialize_payment', 'success');
    return res.status(200).json({
        status: 'success',
        message: 'Payment initialized successfully!',
        data: {
            authorizationUrl,
        },
    });
});

export const verifyPayment = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { reference } = req.params as { reference : string };

    if(!userId) {
        wideLogger.addCtx('action', 'verify_payment_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    if(!reference) {
        wideLogger.addCtx('verify_payment', 'missing_fields');
        throw new AppError('Reference is required!', 401, 'MISSING_FIELDS');
    };

    const result = await paymentService.verifyPayment(reference);

    return res.status(200).json({
        status: 'success',
        message: 'Payment verified Successfully!',
        data: {
            result,
        },
    });
});

export const cancelSubscription = catchAsync(async(req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if(!userId) {
        wideLogger.addCtx('action', 'cancel_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    const result = await paymentService.cancelSubscription(userId);

    return res.status(200).json({
        status: 'success',
        message: 'Subscription cancelled successfully',
        data: {
            result,
        }
    });
});
