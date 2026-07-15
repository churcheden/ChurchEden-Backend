import { GoogleGenerativeAI } from '@google/generative-ai';
import pgvector from 'pgvector';
import { prisma } from '../config/prisma.js'
import { chunkText } from '../utils/chunker.js';
import { Prisma } from '@prisma/client';
import { env } from '../env.js';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const embeddingModel = genAI.getGenerativeModel({
    model: 'text-embedding-004',
});

export async function generateEmbedding(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text)
    return result.embedding.values
};

export const embedSourceInBackground = async (sourceId: string, text: string) => {
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 });

    for(const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);

        await prisma.$executeRaw(
        Prisma.sql`
            INSERT INTO "DocumentChunks" (id, "sourceId", content, embedding)
            VALUES (
            gen_random_uuid(),
            ${sourceId},
            ${chunk},
            ${pgvector.toSql(embedding)}::vector
            )
        `);

        await new Promise ( r => setTimeout(r, 200));
    };

    await prisma?.source.update({
        where: {
            id: sourceId,
        },
        data: {
            embeddingDone: true,
        },
    });
};
