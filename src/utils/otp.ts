import { randomInt } from 'crypto';

export const generateOTP = (): string => {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
};
