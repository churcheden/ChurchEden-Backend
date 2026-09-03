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
            superAdminId?: string;
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

const resolveSuperAdmin = async (superAdminId?: string, customerEmail?: string) => {
    if (superAdminId) {
        const superAdmin = await prisma.superAdmin.findUnique({
            where: { id: superAdminId },
            select: { id: true, email: true, fullName: true, church: { select: { id: true, planExpiresAt: true } } },
        });
        if (superAdmin) return superAdmin;
    }

    if (customerEmail) {
        return prisma.superAdmin.findUnique({
            where: { email: customerEmail },
            select: { id: true, email: true, fullName: true, church: { select: { id: true, planExpiresAt: true } } },
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
    superAdminId: string | undefined,
    customerEmail: string | undefined,
    buildEmail: (fullName: string | null, appUrl: string) => ReturnType<typeof chargeSuccessEmail>,
) => {
    const superAdmin = await resolveSuperAdmin(superAdminId, customerEmail);
    if (!superAdmin) {
        wideLogger.addCtx('payment_email', 'admin_not_found');
        return;
    }

    const content = buildEmail(superAdmin.fullName, env.FRONTEND_URL);
    await emailService.sendPaymentEmail(superAdmin.email, content);
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
    const superAdminId = data.metadata?.superAdminId ?? data.metadata?.userId;
    const customerEmail = data.customer?.email;

    wideLogger.addCtx('webhook_event', event);

    res.status(200).json({ message: 'Webhook received' });

    try {
        switch (event) {
            case 'charge.success': {
                wideLogger.addCtx('webhook_event', 'charge_success');

                if (!data.reference) break;

                const transaction = await prisma.churchTransaction.findUnique({
                    where: { reference: data.reference },
                });

                if (transaction?.status === 'success') break;

                const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();

                if (!transaction) {
                    wideLogger.addCtx('charge_success_result', 'no_matching_transaction');
                    break;
                };

                await Promise.all([
                    prisma.church.updateMany({
                        where: { superAdminId: transaction.superAdminId },
                        data: {
                            plan: 'PRO',
                            planStartedAt: paidAt,
                            planExpiresAt: new Date(paidAt.getTime() + SUBSCRIPTION_PERIOD_MS),
                            subscriptionStatus: 'ACTIVE',
                        },
                    }),
                    prisma.churchTransaction.update({
                        where: { reference: data.reference },
                        data: { status: 'success' },
                    }),
                ]);

                await CacheService.invalidatePattern(`user:${transaction.superAdminId}:*`);
                await sendPaymentEmail(transaction.superAdminId, customerEmail, (fullName, appUrl) =>
                    chargeSuccessEmail(fullName, appUrl),
                );

                wideLogger.addCtx('charge_success_result', 'plan_activated');
                break;
            }

            case 'charge.failed': {
                wideLogger.addCtx('webhook_event', 'charge_failed');

                if (data.reference) {
                    await prisma.churchTransaction.updateMany({
                        where: { reference: data.reference, status: 'pending' },
                        data: { status: 'failed' },
                    });
                }

                await sendPaymentEmail(superAdminId, customerEmail, (fullName, appUrl) =>
                    chargeFailedEmail(fullName, appUrl),
                );

                wideLogger.addCtx('charge_failed_result', 'email_sent');
                break;
            }

            case 'subscription.create': {
                wideLogger.addCtx('webhook_event', 'subscription_create');

                const superAdmin = await resolveSuperAdmin(superAdminId, customerEmail);
                if (!superAdmin) break;

                const subCode = data.subscription?.subscription_code;
                const emailToken = data.subscription?.email_token;

                if (subCode && emailToken) {
                    await prisma.church.updateMany({
                        where: { superAdminId: superAdmin.id },
                        data: {
                            subscriptionProcessor: 'paystack',
                            subscriptionRef: subCode,
                            subscriptionStatus: 'ACTIVE',
                        },
                    });
                }

                const nextBillingDate =
                    parsePaystackDate(data.subscription?.next_payment_date) ??
                    new Date(Date.now() + SUBSCRIPTION_PERIOD_MS);

                const content = subscriptionCreateEmail(superAdmin.fullName, nextBillingDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(superAdmin.email, content);

                wideLogger.addCtx('subscription_create_result', 'email_sent');
                break;
            }

            case 'subscription.disable': {
                wideLogger.addCtx('webhook_event', 'subscription_disable');

                const superAdmin = await resolveSuperAdmin(superAdminId, customerEmail);
                if (!superAdmin) break;

                const expiryDate = superAdmin.church?.planExpiresAt ?? new Date();

                await prisma.church.updateMany({
                    where: { superAdminId: superAdmin.id },
                    data: {
                        plan: 'FREE',
                        planExpiresAt: expiryDate,
                        subscriptionStatus: 'CANCELED',
                    },
                });

                await CacheService.invalidatePattern(`user:${superAdmin.id}:*`);

                const content = subscriptionDisableEmail(superAdmin.fullName, expiryDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(superAdmin.email, content);

                wideLogger.addCtx('subscription_disable_result', 'plan_deactivated');
                break;
            }

            case 'subscription.not_renew': {
                wideLogger.addCtx('webhook_event', 'subscription_not_renew');

                const superAdmin = await resolveSuperAdmin(superAdminId, customerEmail);
                if (!superAdmin) break;

                const expiryDate = superAdmin.church?.planExpiresAt ?? new Date(Date.now() + SUBSCRIPTION_PERIOD_MS);

                await prisma.church.updateMany({
                    where: { superAdminId: superAdmin.id },
                    data: { subscriptionStatus: 'PAST_DUE' },
                });

                const content = subscriptionNotRenewEmail(superAdmin.fullName, expiryDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(superAdmin.email, content);

                wideLogger.addCtx('subscription_not_renew_result', 'email_sent');
                break;
            }

            case 'invoice.update': {
                wideLogger.addCtx('webhook_event', 'invoice_update');

                if (!superAdminId || data.status !== 'success') break;

                const superAdmin = await prisma.superAdmin.findUnique({
                    where: { id: superAdminId },
                    select: { email: true, fullName: true, church: { select: { planExpiresAt: true } } },
                });

                if (!superAdmin) break;

                const currentExpiry = superAdmin.church?.planExpiresAt ?? new Date();
                const newExpiry = new Date(currentExpiry.getTime() + SUBSCRIPTION_PERIOD_MS);
                const nextBillingDate =
                    parsePaystackDate(data.subscription?.next_payment_date) ?? newExpiry;

                await prisma.church.updateMany({
                    where: { superAdminId },
                    data: {
                        plan: 'PRO',
                        planExpiresAt: newExpiry,
                    },
                });

                await CacheService.invalidatePattern(`user:${superAdminId}:*`);

                const content = invoiceRenewalSuccessEmail(superAdmin.fullName, nextBillingDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(superAdmin.email, content);

                wideLogger.addCtx('invoice_update_result', 'plan_extended');
                break;
            }

            case 'invoice.payment_failed': {
                wideLogger.addCtx('webhook_event', 'invoice_payment_failed');

                if (!superAdminId) break;

                const graceEndDate = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

                const superAdmin = await prisma.superAdmin.findUnique({
                    where: { id: superAdminId },
                    select: { email: true, fullName: true },
                });

                if (!superAdmin) break;

                await prisma.church.updateMany({
                    where: { superAdminId },
                    data: { planExpiresAt: graceEndDate },
                });

                await CacheService.invalidatePattern(`user:${superAdminId}:*`);

                const content = invoicePaymentFailedEmail(superAdmin.fullName, graceEndDate, env.FRONTEND_URL);
                await emailService.sendPaymentEmail(superAdmin.email, content);

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
