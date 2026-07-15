import type { Request, Response, NextFunction } from 'express';

export const parseMultipartJsonField = (fieldName = "data") => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Read the string from the multipart form field as raw input
        const raw = req.body?.[fieldName];

        // if the field isn't present then there's no profile pic, so we can just move on
        if (!raw) return next();

        // Make sure the field(apart from the file field) is a string
        if (typeof raw !== "string") {
            return res.status(400).json({
                status: "fail",
                message: `${fieldName} field must be a string`
            });
        };
        try {
            // Try to parse the string as JSON
            const parsed = JSON.parse(raw);

            // If parsing succeeded but the result isn't an object, return an error
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                return res.status(400).json({
                    status: "fail",
                    message: `${fieldName} field must be a valid JSON object`
                })
            }

            // Merge the parsed object into req.body and remove the original string field
            req.body = {
                ...req.body,
                ...parsed
            }

            delete req.body[fieldName];

            next();
        } catch (err) {
            return res.status(400).json({
                status: "fail",
                message: `Invalid JSON in ${fieldName} field`
            })
        }
    }
}