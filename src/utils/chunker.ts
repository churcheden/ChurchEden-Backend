interface ChunkOptions {
    chunkSize: number,
    overlap: number,
};

export const chunkText = (text: string, options: ChunkOptions): string[] => {
    const { chunkSize, overlap } = options;
    const words = text.split(' ');
    const chunks: string[] = [];

    let start = 0;

    while(start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        const chunk = words.slice(start, end).join(' ');

        if(chunk.length > 0) {
            chunks.push(chunk);
        };
    };
    start += chunkSize - overlap;

    return chunks;
};
