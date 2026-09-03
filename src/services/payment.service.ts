import { prisma } from "../config/prisma.js";
import { env } from "../env.js";
import { AppError } from "../utils/AppError.js";
import { cacheKeys, CacheService } from "../utils/cache.js";

interface PaystackInitResponse {
    status: Boolean;
    message: string;
    data: {
        authorization_url: string,
        reference: string,
        access_code: string,
    },
};

interface PaystackVerifyResponse {
    status: boolean,
    message: string,
    data: {
        status: string,
        reference: string,
        amount: string;
        currency: string;
        metadata: {
            superAdminId: string,
        },
        customer: {
            email: string,
        },
        paid_at: string,
    }
}

export interface PaystackCancelResponse {
  status: boolean
  message: string
}

class PaymentService {

    async initializePayment ({
        superAdminId,
        email,
    }: { superAdminId: string, email: string }) {
        const thirtyMinutesAgo = new Date(Date.now() -  30 * 60 * 1000);

        const existingTransaction = await prisma.churchTransaction.findFirst({
            where: {
                superAdminId: superAdminId,
                status: 'pending',
                createdAt: { gt: thirtyMinutesAgo }
            },
        });

        if (existingTransaction) {
            return {
                authorizationUrl: existingTransaction.authorizationUrl,
                reference: existingTransaction.reference,
            };
        };

        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: env.SUBSCRIPTION_AMOUNT_KOBO,
                plan: env.PAYSTACK_PLAN_CODE,
                currency: "GHS",
                metadata: {
                    superAdminId,
                },
                callback_url:`${env.FRONTEND_URL}/payment/verify`
            })
        });

        const data = await response.json() as PaystackInitResponse;

        if(!data.status) {
            throw new AppError(`Paystack error: ${data.message}`, 400, 'PAYSTACK_ERROR');
        };

        await prisma.churchTransaction.create({
            data: {
                superAdminId: superAdminId,
                reference: data.data!.reference,
                amount: env.SUBSCRIPTION_AMOUNT_KOBO,
                authorizationUrl: data.data.authorization_url,
                status: 'pending',
            },
        });

        return {
            authorizationUrl: data.data?.authorization_url,
            reference: data.data?.reference,
        };
    };

    async verifyPayment (reference: string) {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": 'application/json'
            },
        });

        const data = await response.json() as PaystackVerifyResponse;

        if(!data.status){
            throw new AppError(`Paystack error: ${data.message}`, 400, 'PAYSTACK_ERROR')
        };

        if(data.data.status !== 'success') {
            throw new AppError('Payment was not successful!', 400, 'PAYMENT_FAILED');
        };

        const superAdminId = data.data.metadata.superAdminId;

        const existingTransaction = await prisma.churchTransaction.findUnique({
            where: {
                reference: reference,
            },
        });

        if(!existingTransaction) {
            throw new AppError('Transaction Not Found', 404, 'TRANSACTION_NOT_FOUND');
        };

        if(existingTransaction.status === 'success') {
            throw new AppError('Transaction already processed!', 404, 'TRANSACTION_ALREADY_PROCESSED');
        };

        const [updatedChurch] = await Promise.all([
            prisma.church.updateMany({
                where: { superAdminId },
                data: {
                    plan: 'PRO',
                    planStartedAt: new Date(),
                    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    subscriptionProcessor: 'paystack',
                },
            }),

            CacheService.invalidatePattern(cacheKeys.user(superAdminId)),

            prisma.churchTransaction.update({
                where: {
                    reference: reference,
                },
                data: {
                    status: 'success',
                },
            }),
        ]);

        return {
            planUpdated: updatedChurch.count > 0,
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
    };

    async cancelSubscription(superAdminId: string) {
        const church = await prisma.church.findUnique({
            where: { superAdminId },
            select: { id: true, plan: true, subscriptionRef: true, subscriptionProcessor: true },
        });

        if (!church?.subscriptionRef || church.subscriptionProcessor !== 'paystack') {
            throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION')
        };

        const response = await fetch(`https://api.paystack.co/subscription/disable`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": 'application/json'
            },
            body: JSON.stringify(
                {
                    code: church.subscriptionRef,
                    token: '',
                }
            ),
        });

        const data = await response.json() as PaystackCancelResponse;

        if(!data.status){
            throw new AppError(`Paystack error: ${data.message}`, 400, 'PAYSTACK_ERROR')
        };

        await CacheService.invalidatePattern(cacheKeys.user(superAdminId));

        const updatedChurch = await prisma.church.update({
            where: { superAdminId },
            data: {
                plan: 'FREE',
                planExpiresAt: new Date(),
                subscriptionStatus: 'CANCELED',
            },
        });

        return {
            plan: updatedChurch.plan,
            planExpiresAt: updatedChurch.planExpiresAt,
        };
    };
};

export const paymentService = new PaymentService();
