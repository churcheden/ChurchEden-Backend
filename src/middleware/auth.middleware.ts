import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
    user?: JwtPayload | undefined;
}

export const extractAccessToken = (req: Request): string | undefined => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    return req.cookies?.token;
};

export const authenticateToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    const token = extractAccessToken(req);

    if (!token) {
        return res.status(401).json({
            status: 'error',
            code: 'MISSING_TOKEN',
            message: 'No token provided',
        });
    }

    try {
        const payload = await verifyAccessToken(token);
        req.user = payload;
        next();
    } catch (error) {
        if (error instanceof Error && error.message.includes('expired')) {
            return res.status(401).json({
                status: 'error',
                code: 'TOKEN_EXPIRED',
                message: 'Token has expired',
            });
        }

        return res.status(401).json({
            status: 'error',
            code: 'INVALID_TOKEN',
            message: 'Invalid token',
        });
    }
};
