import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export interface GoogleIdTokenPayload extends JWTPayload {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
}

/**
 * Verifies a Google ID token and returns its verified payload.
 * Throws if the token is not signed by Google, has an unexpected issuer,
 * or was issued to a client that is not in the allowed audience list.
 */
export const verifyGoogleIdToken = async (
    idToken: string,
    allowedAudiences: string[],
): Promise<GoogleIdTokenPayload> => {
    const { payload } = await jwtVerify(idToken, jwks, {
        issuer: ['accounts.google.com', 'https://accounts.google.com'],
        audience: allowedAudiences,
    });
    return payload as GoogleIdTokenPayload;
};
