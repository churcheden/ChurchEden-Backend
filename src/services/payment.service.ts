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
            userId: string,
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
        userId, 
        email, 
        amount 
    }: { userId: string, email: string, amount: string }) {
        const thirtyMinutesAgo = new Date(Date.now() -  30 * 60 * 1000);

        const existingTransaction = await prisma.transaction.findFirst({
            where: {
                userId: userId,
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
                amount,
                plan: env.PAYSTACK_PLAN_CODE,
                currency: "GHS",
                metadata: {
                    userId,
                },
                callback_url:`${env.FRONTEND_URL}/payment/verify`
            })
        });

        const data = await response.json() as PaystackInitResponse;

        if(!data.status) {
            throw new AppError(`Paystack error: ${data.message}`, 400, 'PAYSTACK_ERROR');
        };

        await prisma.transaction.create({
            data: {
                userId: userId,
                reference: data.data!.reference,
                amount: amount,
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
            method: 'POST',
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

        const userId = data.data.metadata.userId;

        const existingTransaction = await prisma.transaction.findUnique({
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

        const [ updatedUser ] = await Promise.all([
            prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    isPremium: true,
                    premiumSince: new Date(),
                    premiumExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                }
            }),

            await CacheService.invalidatePattern(cacheKeys.user(userId)),

            prisma.transaction.update({
                where: {
                    reference: reference,
                },
                data: {
                    status: 'success',
                },
            }),
        ]);

        return {
            isPremium: updatedUser.isPremium,
            premiuinSince: updatedUser.premiumSince,     
            premiuimExpiry: updatedUser.premiumExpiry,  
        };
    };

    async cancelSubscription(userId: string) {
        const subscription = await prisma.subscription.findUnique({
            where: { userId }
        });

        if (!subscription) {
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
                    code: subscription.paystackSubCode ,
                    token: subscription.paystackEmailToken,
                }
            ),
        });

        const data = await response.json() as PaystackCancelResponse;

        if(!data.status){
            throw new AppError(`Paystack error: ${data.message}`, 400, 'PAYSTACK_ERROR')
        };

        await prisma.subscription.update({
            where: {
                userId: userId,
            },
            data: {
                status: 'cancelled'
            },
        });

        await CacheService.invalidatePattern(cacheKeys.user(userId));

        const updatedUser = await prisma.user.update({
            where:{
                id: userId,
            },
            data: {
                isPremium: false,
                premiumExpiry: new Date(),
            },
        });

        return {
            isPremium: updatedUser.isPremium,
            premiuinSince: updatedUser.premiumSince,     
            premiuimExpiry: updatedUser.premiumExpiry,   
        };
    };
};

export const paymentService = new PaymentService();
