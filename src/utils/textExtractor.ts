import officeParser from 'officeparser';
import mammoth from 'mammoth';
import { AppError } from './AppError.js';
import { YoutubeTranscript } from 'youtube-transcript';
import { createRequire } from 'module'
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { fromBuffer } from "pdf2pic";
import Tesseract from "tesseract.js";

export interface ExtractionResult {
    text: string;
    pageCount?: number | undefined;
    wordCount: number;
    extractedAt: Date; 
};

function buildResult(text: string, pageCount?: number): ExtractionResult {
    const cleaned = text
    .replace(/\s+/g,' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

    return {
        text: cleaned,
        pageCount: pageCount,
        wordCount: cleaned.split(' ').length,
        extractedAt: new Date(),
    };
};

export async function extractWithOCR(pdfBuffer: Buffer) {
    const convert = fromBuffer(pdfBuffer, {
        density: 300,
        format: "png",
        width: 2000,
        height: 2000,
    });

    let text = "";
    let page = 1;

    while (true) {
        try {
            const image = await convert(page, { responseType: "buffer" });

            const result = await Tesseract.recognize(
                image.buffer,
                "eng"
            );

            text += result.data.text + "\n";
            page++;
        } catch {
            break;
        }
    }

    return {
        text,
        sourceType: "PDF_OCR",
    };
}

export async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const result = await pdfParse(buffer)

        if (!result.text || result.text.trim().length < 50) {
            const scannedPdf = await extractWithOCR(buffer);
            return buildResult(scannedPdf.text, result.numpages);
        };

        return buildResult(result.text, result.numpages);

    } catch (error: any) {
        throw new AppError("PDF extraction failed!", 400, "EXTRACTION_FAILED");
    };
};

export async function extractFromPPTX(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const ast = await officeParser.parseOffice(buffer);
        const { value: text } = await ast.to('text');

        if (!text || text.trim().length < 10) {
            throw new AppError("PPTX extraction failed!", 400, "EXTRACTION_FAILED");
        }

        return buildResult(text);

    } catch (error: any) {
            throw new AppError("PPTX extraction failed!", 400, "EXTRACTION_FAILED");
    }
};

export async function extractFromDOCX(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const text = await mammoth.extractRawText({ buffer });

        if(text.messages.length > 0) {
            console.warn('DOCX extraction warnings :', text.messages)
        };

        if(!text.value) {
            throw new AppError("DOCX extraction failed!", 400, "EXTRACTION_FAILED");
        };

        return buildResult(text.value);

    } catch (error: any) {
            throw new AppError("DOCX extraction failed!", 400, "EXTRACTION_FAILED");
    };
};

export async function extractFromTXT(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const text = buffer.toString('utf-8');

        if(!text || text.trim().length < 10) {
            throw new AppError("TXT extraction failed!", 400, "EXTRACTION_FAILED");
        };

        return buildResult(text);

    } catch (error: any) {
            throw new AppError("TXT extraction failed!", 400, "EXTRACTION_FAILED");
    };
};

export function extractYouTubeId(url: string): string | null | undefined {
    const patterns = [
        /youtube\.com\/watch\?v=([^&]+)/,
        /youtu\.be\/([^?]+)/,
        /youtube\.com\/embed\/([^?]+)/,
        /youtube\.com\/shorts\/([^?]+)/,
    ];

    for(const pattern of patterns) {
        const match = url.match(pattern);
        if(match) return match[1]
    };

    return null;
};

export async function extractFromYouTube(url: string): Promise<ExtractionResult> {
    try {
        const videoId = extractYouTubeId(url);

        if(!videoId) {
            throw new AppError("Invalid YouTube url!", 400, "INVALID_URL");
        };

        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        const text = transcriptItems
            .map(item => item.text)
            .join(' ')
            .replace(/\[.*?\]/g, '');

        if(!text) {
            throw new AppError("YouTube extraction failed!", 404, "EXTRACTION_FAILED");
        };

        return buildResult(text);

    } catch (error: any) {
        if(error.messages?.includes('disabled')) {
            throw new AppError("This YouTube video has captions disabled!", 400, "EXTRACTION_FAILED");
        }
        throw new AppError("YouTube extraction failed!", 400, "EXTRACTION_FAILED");
    };
};

export async function extractText(
    buffer?: Buffer,
    mimeType?: string,
    url?: string
): Promise<ExtractionResult> {

    if (url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return extractFromYouTube(url);
        }

        throw new Error('Unsupported URL source');
    }

    if (!buffer) {
        throw new Error('No buffer or URL provided');
    }

    switch (mimeType) {
        case 'application/pdf':
            return extractFromPDF(buffer);

        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            return extractFromPPTX(buffer);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return extractFromDOCX(buffer);

        case 'text/plain':
            return extractFromTXT(buffer);

        default:
            throw new Error(`Unsupported file type: ${mimeType}`);
    }
}
