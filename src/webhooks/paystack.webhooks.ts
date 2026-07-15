import type { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { wideLogger } from '../utils/wideLogger.js';
import { CacheService } from '../utils/cache.js';
import { env } from '../env.js';
import { emailService } from '../services/email.service.js';
import {
    chargeFailedEmail,
    chargeSuccessEmail,
    invoicePaymentFailedEmail,
    invoiceRenewalSuccessEmail,
    subscriptionCreateEmail,
    subscriptionDisableEmail,
    subscriptionNotRenewEmail,
} from '../template/paymentEmails.js';

interface PaystackWebhookPayload {
    event: string;
    data: {
        status?: string;
        reference?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
        metadata?: {
            userId?: string;
        };
        customer?: {
            email?: string;
            customer_code?: string;
        };
        subscription?: {
            status?: string;
            subscription_code?: string;
            email_token?: string;
            next_payment_date?: string;
        };
        plan?: {
            name?: string;
            amount?: number;
        };
    };
}

const GRACE_PERIOD_DAYS = 3;
const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const verifyWebhookSignature = (req: Request): boolean => {
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) return false;

    const hash = crypto
        .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
        .update(req.body)
        .digest('hex');

    const hashBuf = Buffer.from(hash);
    const signBuf = Buffer.from(signature);


    if(hashBuf.length !== signBuf.length) return false;

    return crypto.timingSafeEqual(hashBuf, signBuf);
};

const resolveUser = async (userId?: string, customerEmail?: string) => {
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, fullName: true, premiumExpiry: true },
        });
        if (user) return user;
    }

    if (customerEmail) {
        return prisma.user.findUnique({
            where: { email: customerEmail },
            select: { id: true, email: true, fullName: true, premiumExpiry: true },
        });
    }

    return null;
};

const parsePaystackDate = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sendPaymentEmail = async (
    userId: string | undefined,
    customerEmail: string | undefined,
    buildEmail: (fullName: string | null, appUrl: string) => ReturnType<typeof chargeSuccessEmail>,
) => {
    const user = await resolveUser(userId, customerEmail);
    if (!user) {
        wideLogger.addCtx('payment_email', 'user_not_found');
        return;
    }

    const content = buildEmail(user.fullName, env.FRONTEND_URL);
    await emailService.sendPaymentEmail(user.email, content);
};

export const handlePaymentEvent = async (req: Request, res: Response) => {
    wideLogger.addCtx('action', 'paystack_webhook');

    if (!verifyWebhookSignature(req)) {
        wideLogger.addCtx('paystack_webhook', 'Invalid');
        return res.status(401).json({
            status: 'fail',
            message: 'Invalid signature!',
        });
    }

    const payload: PaystackWebhookPayload = JSON.parse(req.body.toString());
    const { event, data } = payload;
    const userId = data.metadata?.userId;
    const customerEmail = data.customer?.email;

    wideLogger.addCtx('webhook_event', event);

    res.status(200).json({ message: 'Webhook received' });

    try {
        switch (event) {
            case 'charge.success': {
                wideLogger.addCtx('webhook_event', 'charge_success');

                if (!data.reference || !userId) break;

                const transaction = await prisma.transaction.findUnique({
                    where: { reference: data.reference },
                });

                if (transaction?.status === 'success') break;

                const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();

                if (!transaction) {
                    wideLogger.addCtx('charge_success_result', 'no_matching_transaction');
                    break;
                };

                await Promise.all([
                    prisma.user.update({
                        where: { id: userId },
                        data: {
                            isPremium: true,
                            premiumSince: paidAt,
                            premiumExpiry: new Date(paidAt.getTime() + SUBSCRIPTION_PERIOD_MS),
                        },
                    }),
                    prisma.transaction.update({
                        where: { reference: data.reference },
                        data: { status: 'success' },
                    }),
                ]);

                await CacheService.invalidatePattern(`user:${userId}:*`);
                await sendPaymentEmail(userId, customerEmail, (fullName, appUrl) =>
                    chargeSuccessEmail(fullName, appUrl),
                );

                wideLogger.addCtx('charge_success_result', 'premium_activated');
                break;
            }

            case 'charge.failed': {
                wideLogger.addCtx('webhook_event', 'charge_failed');

                if (data.reference) {
                    await prisma.transaction.updateMany({
                        where: { reference: data.reference, status: 'pending' },
                        data: { status: 'failed' },
                    });
                }

                await sendPaymentEmail(userId, customerEmail, (fullName, appUrl) =>
                    chargeFailedEmail(fullName, appUrl),
                );

                wideLogger.addCtx('charge_failed_result', 'email_sent');
                break;
            }

            case 'subscription.create': {
                wideLogger.addCtx('webhook_event', 'subscription_create');

                const user = await resolveUser(userId, customerEmail);
                if (!user) break;

                const subCode = data.subscription?.subscription_code;
                const emailToken = data.subscription?.email_token;

                if (subCode && emailToken) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            paystackSubCode: subCode,
                            paystackEmailToken: emailToken,
                            subscriptionStatus: 'active',
                        },
                    });
                }

                const nextBillingDate =
                    parsePaystackDate(data.subscription?.next_payment_date) ??
                    new Date(Date.now() + SUBSCRIPTION_PERIOD_MS);

                const content = subscriptionCreateEmail(user.fullName, nextBillingDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(user.email, content);

                wideLogger.addCtx('subscription_create_result', 'email_sent');
                break;
            }

            case 'subscription.disable': {
                wideLogger.addCtx('webhook_event', 'subscription_disable');

                const user = await resolveUser(userId, customerEmail);
                if (!user) break;

                const expiryDate = user.premiumExpiry ?? new Date();

                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        isPremium: false,
                        premiumExpiry: expiryDate,
                        subscriptionStatus: 'cancelled',
                    },
                });

                await CacheService.invalidatePattern(`user:${user.id}:*`);

                const content = subscriptionDisableEmail(user.fullName, expiryDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(user.email, content);

                wideLogger.addCtx('subscription_disable_result', 'premium_deactivated');
                break;
            }

            case 'subscription.not_renew': {
                wideLogger.addCtx('webhook_event', 'subscription_not_renew');

                const user = await resolveUser(userId, customerEmail);
                if (!user) break;

                const expiryDate = user.premiumExpiry ?? new Date(Date.now() + SUBSCRIPTION_PERIOD_MS);

                await prisma.user.update({
                    where: { id: user.id },
                    data: { subscriptionStatus: 'non_renewing' },
                });

                const content = subscriptionNotRenewEmail(user.fullName, expiryDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(user.email, content);

                wideLogger.addCtx('subscription_not_renew_result', 'email_sent');
                break;
            }

            case 'invoice.update': {
                wideLogger.addCtx('webhook_event', 'invoice_update');

                if (!userId || data.status !== 'success') break;

                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { premiumExpiry: true, fullName: true, email: true },
                });

                if (!user) break;

                const currentExpiry = user.premiumExpiry ?? new Date();
                const newExpiry = new Date(currentExpiry.getTime() + SUBSCRIPTION_PERIOD_MS);
                const nextBillingDate =
                    parsePaystackDate(data.subscription?.next_payment_date) ?? newExpiry;

                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isPremium: true,
                        premiumExpiry: newExpiry,
                    },
                });

                await CacheService.invalidatePattern(`user:${userId}:*`);

                const content = invoiceRenewalSuccessEmail(user.fullName, nextBillingDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(user.email, content);

                wideLogger.addCtx('invoice_update_result', 'premium_extended');
                break;
            }

            case 'invoice.payment_failed': {
                wideLogger.addCtx('webhook_event', 'invoice_payment_failed');

                if (!userId) break;

                const graceEndDate = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

                const user = await prisma.user.update({
                    where: { id: userId },
                    data: { premiumExpiry: graceEndDate },
                    select: { email: true, fullName: true },
                });

                await CacheService.invalidatePattern(`user:${userId}:*`);

                const content = invoicePaymentFailedEmail(user.fullName, graceEndDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(user.email, content);

                wideLogger.addCtx('invoice_payment_failed_result', 'grace_period_set');
                break;
            }

            default:
                wideLogger.addCtx('webhook_event', `unhandled_${event}`);
                break;
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
        wideLogger.addCtx('webhook_error', String(error));
    }
};
