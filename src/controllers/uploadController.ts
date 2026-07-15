import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { wideLogger } from "../utils/wideLogger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { extractText } from "../utils/textExtractor.js";

// Single Source upload
export const uploadSingleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file as Express.Multer.File;
    const fileName = file.originalname;
    const mimeType = file.mimetype;
    const { url } = req.body;
    const { chatId } = req.params as { chatId: string };
    const userId = req.user?.id;

    wideLogger.addCtx('action', 'upload_single_source');

    if(!userId) {
            wideLogger.addCtx('action', 'upload_source_unauthorized');
            throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    const chat = await prisma.chat.findUnique({
        where: {
            id: chatId,
        },
    });

    if(!chat) {
        wideLogger.addCtx('upload_single_source', 'chat_not_found');
        throw new AppError('Chat not found!', 404, 'CHAT_NOT_FOUND');
    };

    if(url) {
        const content = await extractText(undefined, undefined, url);
        const source = await prisma.source.create({
            data: {
                sourceName: url,
                chatId: chatId,
                userId: userId,
                content: content.text,
            },
            select: {
                id: true,
                sourceName: true,
                content: true,
            },
        });

        await prisma.chat.update({
            where: {
                id: chatId,
            },
            data: {
                isSummaryAllowed: true,
            },
        });

        return res.status(200).json({
            status: 'success',
            message: 'YouTube source uploaded succesfully!',
        });
    };
    
    const content = await extractText(file.buffer, mimeType);
    const source = await prisma.source.create({
        data: {
            sourceName: fileName,
            chatId: chatId,
            userId: userId,
            content: content.text,
        },
        select: {
            id: true,
            sourceName: true,
            content: true,
        },
    });

    await prisma.chat.update({
        where: {
            id: chatId,
        },
        data: {
            isSummaryAllowed: true,
        },
    });

    return res.status(200).json({
        status: 'success',
        message: 'File source uploaded succesfully!',
        data: {
            ...source,
        },
    });
});

// Multiple Source upload
export const uploadMutipleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const { chatId } = req.params as { chatId: string };
    const userId = req.user?.id;

    wideLogger.addCtx('action', 'upload_multiple_source');

    if(!userId) {
        wideLogger.addCtx('action', 'upload_source_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    const chat = await prisma.chat.findUnique({
        where: {
            id: chatId,
        },
    });

    if(!chat) {
        wideLogger.addCtx('upload_multiple_source', 'chat_not_found');
        throw new AppError('Chat not found!', 404, 'CHAT_NOT_FOUND');
    };

    let sourceIds = [];

    for(const file of files) {
        let mimeType = file.mimetype;
        let fileName = file.originalname;
        const content = await extractText(file.buffer, mimeType);

        const source = await prisma.source.create({
            data: {
                sourceName: fileName,
                chatId: chatId,
                userId: userId,
                content: content.text,
            },
        });

        sourceIds.push(source.id);
    };

    await prisma.chat.update({
        where: {
            id: chatId,
        },
        data: {
            isSummaryAllowed: true,
        },
    });

    return res.status(200).json({
        status: 'success',
        message: 'File source uploaded succesfully!',
        data: {
            sourceIds,
        }
    });
});

// Single Source deletion
export const deleteSingleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const { sourceId } = req.params as { sourceId: string };
    const userId = req.user?.id;
    const { chatId } = req.body;

    wideLogger.addCtx('action', 'delete_single_source');

    if(!userId) {
            wideLogger.addCtx('action', 'delete_source_unauthorized');
            throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    await prisma.source.delete({
        where: {
            id: sourceId,
        },
    });

    await prisma.chat.update({
        where: {
            id: chatId,
        },
        data: {
            isSummaryAllowed: true,
        },
    });

    return res.status(200).json({
        status: 'success',
        message: 'YouTube source deleted succesfully!',
    });
});

// Multiple Source deletion
export const deleteMutipleSource = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    const sources = req.body as { sourceId: string }[];
    const userId = req.user?.id;
    const { chatId } = req.body;

    wideLogger.addCtx('action', 'delete_multiple_source');

    if(!userId) {
        wideLogger.addCtx('action', 'delete_multiple_source_unauthorized');
        throw new AppError('Unauthorized user!', 401, 'UNAUTHORIZED');
    };

    const result = await Promise.all(
        sources.map((source) => {
            prisma.source.delete({
                where: {
                    id: source.sourceId,
                },
            });
        })
    );

    await prisma.chat.update({
        where: {
            id: chatId,
        },
        data: {
            isSummaryAllowed: true,
        },
    });

    return res.status(200).json({
        status: 'success',
        message: 'File source deleted succesfully!',
    });
});
