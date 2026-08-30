import type { NextFunction, Response } from 'express';
import type { ChurchRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

export type ChurchIdResolver = (req: AuthenticatedRequest) => Promise<string>;

/**
 * Guards a route so the authenticated user must hold an APPROVED membership in
 * the resolved church with one of the allowed roles. Throws 403 otherwise.
 */
export const requireChurchRole = (roles: ChurchRole[], resolveChurchId: ChurchIdResolver) => {
    return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
            }

            const churchId = await resolveChurchId(req);

            const membership = await prisma.churchMembership.findUnique({
                where: { userId_churchId: { userId, churchId } },
                select: { role: true, status: true, isBanned: true },
            });

            if (!membership || membership.status !== 'APPROVED' || membership.isBanned || !roles.includes(membership.role)) {
                throw new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};