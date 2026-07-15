import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { wideLogger } from "../utils/wideLogger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { extractText } from "../utils/textExtractor.js";

async function getOwnedSource(sourceId: string, userId: string) {
    const source = await prisma.source.findFirst({
        where: { id: sourceId, userId },
    });

    if (!source) {
        throw new AppError('Source not found!', 404, 'SOURCE_NOT_FOUND');
    }

    return source;
}

export const uploadSingleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    const mimeType = file?.mimetype;
    const { url } = req.body;
    const userId = req.user?.id;

    wideLogger.addCtx('action', 'upload_single_source');

    if (!userId) {
        wideLogger.addCtx('action', 'upload_source_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    if (url) {
        const content = await extractText(undefined, undefined, url);
        const source = await prisma.source.create({
            data: {
                sourceName: url,
                userId,
                content: content.text,
            },
            select: {
                id: true,
                sourceName: true,
                content: true,
            },
        });

        return res.status(200).json({
            status: 'success',
            message: 'URL source uploaded successfully!',
            data: source,
        });
    }

    if (!file) {
        throw new AppError('File or URL is required!', 400, 'MISSING_FILE');
    }

    const content = await extractText(file.buffer, mimeType);
    const source = await prisma.source.create({
        data: {
            sourceName: file.originalname,
            userId,
            content: content.text,
        },
        select: {
            id: true,
            sourceName: true,
            content: true,
        },
    });

    return res.status(200).json({
        status: 'success',
        message: 'File source uploaded successfully!',
        data: source,
    });
});

export const uploadMutipleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const userId = req.user?.id;

    wideLogger.addCtx('action', 'upload_multiple_source');

    if (!userId) {
        wideLogger.addCtx('action', 'upload_source_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    const sourceIds: string[] = [];

    for (const file of files) {
        const content = await extractText(file.buffer, file.mimetype);
        const source = await prisma.source.create({
            data: {
                sourceName: file.originalname,
                userId,
                content: content.text,
            },
        });

        sourceIds.push(source.id);
    }

    return res.status(200).json({
        status: 'success',
        message: 'File sources uploaded successfully!',
        data: { sourceIds },
    });
});

export const deleteSingleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { sourceId } = req.params as { sourceId: string };
    const userId = req.user?.id;

    wideLogger.addCtx('action', 'delete_single_source');

    if (!userId) {
        wideLogger.addCtx('action', 'delete_source_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    await getOwnedSource(sourceId, userId);
    await prisma.source.delete({ where: { id: sourceId } });

    return res.status(200).json({
        status: 'success',
        message: 'Source deleted successfully!',
    });
});

export const deleteMutipleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const sources = req.body as { sourceId: string }[];
    const userId = req.user?.id;

    wideLogger.addCtx('action', 'delete_multiple_source');

    if (!userId) {
        wideLogger.addCtx('action', 'delete_multiple_source_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    }

    await Promise.all(
        sources.map(async (source) => {
            await getOwnedSource(source.sourceId, userId);
            await prisma.source.delete({ where: { id: source.sourceId } });
        }),
    );

    return res.status(200).json({
        status: 'success',
        message: 'Sources deleted successfully!',
    });
});
