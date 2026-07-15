import type { Request, Response, NextFunction } from "express";
import { wideLogger } from "../utils/wideLogger.js";
import { env } from "../env.js";
import { AppError } from "../utils/AppError.js";

export const errorHandler = async(
    err: Error, 
    _req: Request, 
    res: Response, 
    _next: NextFunction
) => {
    if(err instanceof AppError) {
        wideLogger.add('err', {
            msg: err.message,
            stack: err.stack || 'No stack trace!',
            code: err.code
        });

        return res.status(err.statusCode).json({
            status: 'error',
            code: err.code,
            message: err.message
        });
    };

    const prismaError = err as unknown as { code?: string };

    if(prismaError.code?.startsWith('P')) {
        wideLogger.add('err', {
            msg: err.message,
            stack: err.stack,
            code: prismaError.code
        });

        const statusCode = prismaErrorMap[prismaError.code] || 500;

        return res.status(statusCode).json({
            status: 'error',
            message: getPrismaErrorMessage(prismaError.code),
        });
    };

    wideLogger.add('err', {
        msg: err.message,
        stack: err.stack,
        code:(err as unknown as { code?: string }).code || 'INTERNAL_ERROR'
    });

    const response = {
        status: 'fail',
        error: 'Internal Server Error',
        ...(env.NODE_ENV !== 'production' && { 
            message: err.message, 
            stack: err.stack || 'No stack trace!'
        })
    };

    res.status(500).json(response);

};

const prismaErrorMap: Record<string, number> = {
    P2000: 400,
    P2001: 404,
    P2002: 409,
    P2003: 400,
    P2005: 404,
};

const getPrismaErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
        P2000: 'The value provided is too long!',
        P2001: 'Record not found!',
        P2002: 'A record with this value already exists!',
        P2003: 'Related record not found!',
        P2005: 'Record not found!',
    };

    return messages[code] || 'A database error occurred!';
};