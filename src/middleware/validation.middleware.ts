import type { Request, Response, NextFunction } from "express";
import { type ZodType, ZodError } from "zod";

export const validateBody = (schema: ZodType<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const validatedData = schema.parse(req.body);
            req.body = validatedData;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_FAILED',
                    message: 'Validation failed!',
                    details: error.issues.map(e => ({
                        field: e.path.join('.'),        
                        code: e.code,                   
                        message: e.message,
                    }))
                });
            }
            next(error);
        }
    }
};

export const validateParams = (schema: ZodType<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const validatedData = schema.parse(req.params);
            req.params = validatedData as Record<string, string>;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_FAILED',
                    message: 'Invalid params!',
                    details: error.issues.map(e => ({
                        field: e.path.join('.'),
                        code: e.code,
                        message: e.message,
                    }))
                });
            }
            next(error);
        }
    }
};

export const validateQuery = (schema: ZodType<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const validatedData = schema.parse(req.query);
            req.query = validatedData as Record<string, string | string[] | undefined>;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_FAILED',
                    message: 'Invalid query!',
                    details: error.issues.map(e => ({
                        field: e.path.join('.'),
                        code: e.code,
                        message: e.message,
                    }))
                });
            }
            next(error);
        }
    }
};