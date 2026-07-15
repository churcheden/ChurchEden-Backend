import { redisClient } from '../config/redis.js';

export class CacheService { 
    /**
     * Set a value in cache with TTL
     * @param key - Cache key
     * @param value - Value to cache (object will be stringified)
     * @param ttlSeconds - TTL in seconds(defualt is 10 minutes)
     */

    static async set(key: string, value: any, ttlSeconds: number = 600): Promise<void> {
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            await redisClient.setEx(key, ttlSeconds, serialized);
        } catch (error) {
            // i didn't throw error to avoid breaking the main flow, just logged and falled back to DB
            console.error(`Cache set error for key ${key}:`, error);
        }
    }

    /**
     * @param key - Cache key
     * returns parsed value(null if not found or expired)
     */
    static async get<T = any>(key: string): Promise<T | null> {
        try {
            const cached = await redisClient.get(key);
            if (!cached) return null;
            
            try {
                return JSON.parse(cached) as T;
            } catch {
                // If parse fails, it's a plain string
                return cached as unknown as T;
            }
        } catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Delete a specific key from cache
     * @param key - Cache key to delete
     */
    static async delete(key: string): Promise<void> {
        try {
            await redisClient.del(key);
        } catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
        }
    }

    /**
     * Get all values whose keys match a pattern
     * @param pattern - Key pattern(eg, 'collage:rank:cache:*')
     * returns a map of key -> parsed value (keys with missing/expired values are skipped)
     */
    static async getPattern<T = any>(pattern: string): Promise<Record<string, T>> {
        const result: Record<string, T> = {};
        try {
            const keys: string[] = [];
            for await (const batch of redisClient.scanIterator({ MATCH: pattern, COUNT: 200 })) {
                keys.push(...batch);
            }
            await Promise.all(keys.map(async (key) => {
                const value = await CacheService.get<T>(key);
                if (value !== null) result[key] = value;
            }));
        } catch (error) {
            console.error(`Cache get pattern error for ${pattern}:`, error);
        }
        return result;
    }

    /**
     * invalidate multiple cache keys
     * @param pattern - Key pattern(eg, 'user:*' or 'user:123:*')
     */
    static async invalidatePattern(pattern: string): Promise<void> {
        try {
            // scanIterator yields batches of keys (non-blocking SCAN).
            const keys: string[] = [];
            for await (const batch of redisClient.scanIterator({ MATCH: pattern, COUNT: 200 })) {
                keys.push(...batch);
            }
            if (keys.length > 0) {
                await Promise.all(keys.map(k => redisClient.del(k)));
            }
        } catch (error) {
            console.error(`Cache invalidate pattern error for ${pattern}:`, error);
        }
    }
};

export const cacheKeys = {
    user: (userId: string) => `user:${userId}`,
    userMe: (userId: string) => `user:${userId}:me`,
    userProfile: (userId: string) => `user:${userId}:profile`,
    userStats: (userId: string) => `user:${userId}:stats`,
    userStreak: (userId: string) => `user:${userId}:streak`,
    enrollment: (userId: string, courseId: string) => `user:${userId}:${courseId}:enrollment`,
    weakPoint: (userId: string, courseId: string) => `user:${userId}:course:${courseId}:weakpoints`,
    recentQuiz: (userId: string) => `user:${userId}:recent:quizzes`,

    collegeRanking: (college: string) => `college:${college}:rankings`,
    facultyRanking: (college: string, facultyId: string) => `faculty:${college}:${facultyId}:rankings`,
    programRanking: (college: string, facultyId: string, programId: string) => `program:${college}:${facultyId}:${programId}:rankings`,
    courseRanking: (courseId: string, college: string) => `course:${courseId}:${college}:rankings`,
    quizSession: (sessionId: string) => `quiz:session:${sessionId}:questions`,
    sessionId: (sessionId: string) => `session:${sessionId}:sessionId`,
    question: (courseId: string) => `course:${courseId}:question`,
    courseProgress: (userId: string, courseId?: string) => courseId ? `progress:${userId}:${courseId}` : `progress:${userId}:profile`,
    studyActivity: (userId: string) => `study:${userId}:profile`,
    collageRankCache: (userId: string) => `collage:rank:cache:${userId}`,
    facultyRankCache: (userId: string) => `faculty:rank:cache:${userId}`,
    programRankCache: (userId: string) => `program:rank:cache:${userId}`,
    courseRankCache: (userId: string, courseId: string) => `course:rank:cache:${userId}:${courseId}`,
    uploadsCache: (userId: string, chatId: string) => `ai:chat:${userId}:${chatId}`,
};
