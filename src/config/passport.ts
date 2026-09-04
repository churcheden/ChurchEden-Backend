import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';
import { env } from '../env.js';
import { hashPassword } from '../utils/password.js';
import { parseOAuthState } from '../utils/oauthState.js';

export const googleStrategy = new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true,
    scope: ['profile', 'email']
},  async(req, _accessToken, _refreshToken, profile, done) => {
    try{
        const { id: googleId, emails, displayName } = profile;
        const email = emails?.[0]?.value;

        if(!email) {
            return done(new Error("No email found in Google profile!"));
        };

        // Mobile Google sign-in authenticates a Member (a church member), never
        // a SuperAdmin. A brand-new mobile user gets a Member row immediately
        // (churchId is optional) and links a church later via the join-request
        // flow. This mirrors the ID-token exchange in exchangeGoogleToken.
        //
        // The platform is carried through Google's `state` parameter, so it is
        // available on the callback (req.query.platform is only set on the
        // initial /auth/google authorize request, not on the redirect back).
        let rawState = typeof req?.query?.state === 'string' ? req.query.state : '';
        try {
            rawState = decodeURIComponent(rawState);
        } catch {
            /* keep the raw state if it's not valid percent-encoding */
        }
        const { platform: statePlatform } = parseOAuthState(rawState);
        const platform =
            (req?.query?.platform as string) ||
            (req?.headers?.['x-client-platform'] as string) ||
            statePlatform ||
            'web';

        if (platform === 'mobile') {
            let member = await prisma.member.findUnique({ where: { googleId } });
            if (!member) {
                member = await prisma.member.upsert({
                    where: { email },
                    create: {
                        email,
                        googleId,
                        isVerified: true,
                        churchId: null,
                    },
                    update: {
                        googleId: googleId,
                        isVerified: true,
                    },
                });
            }

            return done(null, { ...member, accountType: 'MEMBER' as const });
        }

        // Web Google sign-in is admin-only — authenticate against SuperAdmin.
        let superAdmin = await prisma.superAdmin.findUnique({
            where: { googleId }
        });

        if(superAdmin) {
            return done(null, { ...superAdmin, accountType: 'ADMIN' as const })
        };

        superAdmin = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if(superAdmin) {
            superAdmin = await prisma.superAdmin.update({
                where: { id: superAdmin.id },
                data: {
                    loginProvider: 'GOOGLE',
                    googleId: profile.id,
                    isVerified: true,
                    fullName: superAdmin.fullName ?? displayName ?? null,
                }
            })
            return done(null, { ...superAdmin, accountType: 'ADMIN' as const });
        }

        const randomPassword = randomBytes(32).toString('hex');
        const hashedPassword = await hashPassword(randomPassword);

        superAdmin = await prisma.superAdmin.create({
            data: {
                email,
                password: hashedPassword,
                googleId,
                fullName: displayName ?? null,
                loginProvider: 'GOOGLE',
                isVerified: true,
            }
        });
        return done(null, { ...superAdmin, accountType: 'ADMIN' as const });

    }catch(error) {
        done(error as Error, undefined);
    }
});

passport.use(googleStrategy);

export { passport };
